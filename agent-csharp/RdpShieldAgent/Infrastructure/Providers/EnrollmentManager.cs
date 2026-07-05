using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using RdpShieldAgent.Domain.Models;

namespace RdpShieldAgent.Infrastructure.Providers;

public class EnrollmentManager
{
    private readonly AgentConfig _config;
    private readonly ILogger<EnrollmentManager> _logger;
    private static readonly string ProgramDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "RDPShield");
    private static readonly string AgentIdFile = Path.Combine(ProgramDataPath, "agent-id");
    private static readonly string CredsFile = Path.Combine(ProgramDataPath, "cred");

    // Reuse a single HttpClient instance with a 15 seconds timeout to avoid socket exhaustion
    private static readonly HttpClient HttpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };

    public EnrollmentManager(AgentConfig config, ILogger<EnrollmentManager> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task InitializeAndEnrollAsync(string configPath)
    {
        // 1. Ensure directory exists with restrictive ACLs
        EnsureSecureDirectory();

        // 2. Resolve or generate Server ID (GUID)
        string serverId = ResolveServerId();
        _config.ServerId = serverId;

        // 3. Resolve API Key (from DPAPI or enroll)
        string apiKey = await ResolveApiKeyAsync(configPath);
        if (string.IsNullOrEmpty(apiKey))
        {
            throw new InvalidOperationException("No se pudo obtener una clave de API válida (falló el enrolamiento).");
        }
        _config.ApiKey = apiKey;
    }

    private void EnsureSecureDirectory()
    {
        if (!Directory.Exists(ProgramDataPath))
        {
            Directory.CreateDirectory(ProgramDataPath);
        }

        try
        {
            var directoryInfo = new DirectoryInfo(ProgramDataPath);
            var directorySecurity = directoryInfo.GetAccessControl();
            
            // Break inheritance, remove inherited rules
            directorySecurity.SetAccessRuleProtection(true, false);

            // Add SYSTEM full control
            var systemSid = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
            directorySecurity.AddAccessRule(new FileSystemAccessRule(
                systemSid,
                FileSystemRights.FullControl,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                PropagationFlags.None,
                AccessControlType.Allow));

            // Add Administrators full control
            var adminSid = new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null);
            directorySecurity.AddAccessRule(new FileSystemAccessRule(
                adminSid,
                FileSystemRights.FullControl,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
                PropagationFlags.None,
                AccessControlType.Allow));

            directoryInfo.SetAccessControl(directorySecurity);
            _logger.LogInformation("Permisos ACL restrictivos aplicados correctamente en {path}", ProgramDataPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudieron aplicar permisos ACL restrictivos en la carpeta de datos.");
        }
    }

    private string ResolveServerId()
    {
        if (File.Exists(AgentIdFile))
        {
            try
            {
                var content = File.ReadAllText(AgentIdFile).Trim();
                if (Guid.TryParse(content, out _))
                {
                    _logger.LogInformation("ServerId (GUID) cargado desde almacenamiento local: {guid}", content);
                    return content;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error leyendo el archivo de ID del agente.");
            }
        }

        // Generate new GUID
        var newGuid = Guid.NewGuid().ToString();
        try
        {
            File.WriteAllText(AgentIdFile, newGuid);
            _logger.LogInformation("Nuevo ServerId (GUID) generado y guardado: {guid}", newGuid);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error guardando el nuevo ID de agente en {path}", AgentIdFile);
            throw;
        }

        return newGuid;
    }

    private async Task<string> ResolveApiKeyAsync(string configPath)
    {
        // 1. Try to read from DPAPI encrypted storage
        if (File.Exists(CredsFile))
        {
            try
            {
                var encryptedData = File.ReadAllBytes(CredsFile);
                var decryptedData = ProtectedData.Unprotect(encryptedData, null, DataProtectionScope.LocalMachine);
                var apiKey = Encoding.UTF8.GetString(decryptedData).Trim();
                if (!string.IsNullOrEmpty(apiKey))
                {
                    _logger.LogInformation("Clave de API cargada y descifrada con DPAPI.");
                    return apiKey;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Fallo al descifrar la credencial guardada con DPAPI. Se requerirá enrolamiento.");
            }
        }

        // 2. Perform enrollment
        return await PerformEnrollmentAsync(configPath);
    }

    public async Task<string> PerformEnrollmentAsync(string configPath)
    {
        // Read configuration file to get the token and URL
        if (!File.Exists(configPath))
        {
            throw new FileNotFoundException($"Archivo de configuración no encontrado: {configPath}");
        }

        string rawConfig = File.ReadAllText(configPath);
        using var jsonDoc = JsonDocument.Parse(rawConfig);
        var root = jsonDoc.RootElement;

        string? enrollToken = root.TryGetProperty("enroll_token", out var tok) ? tok.GetString() : null;
        // Fallback to config's api_key if no enroll_token property is found (for backwards compatibility/testing)
        if (string.IsNullOrEmpty(enrollToken))
        {
            enrollToken = root.TryGetProperty("api_key", out var key) ? key.GetString() : null;
        }

        if (string.IsNullOrEmpty(enrollToken))
        {
            _logger.LogWarning("No se encontró un 'enroll_token' en el config.json. No es posible enrolar el agente.");
            return string.Empty;
        }

        _logger.LogInformation("Iniciando flujo de enrolamiento con token...");

        // Create enrollment request
        var payload = new
        {
            enroll_token = enrollToken,
            server_guid = _config.ServerId,
            hostname = Environment.MachineName
        };

        string enrollUrl = $"{_config.ApiUrl}/agent/enroll";
        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        // Backoff retry logic
        int attempts = 5;
        int delayMs = 2000;
        HttpResponseMessage? response = null;

        for (int i = 0; i < attempts; i++)
        {
            try
            {
                response = await HttpClient.PostAsync(enrollUrl, content);
                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    _logger.LogWarning("Rate limited (429) por el servidor de enrolamiento. Reintentando...");
                    await Task.Delay(delayMs);
                    delayMs *= 2;
                    continue;
                }
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Fallo de conexión al endpoint de enrolamiento (Intento {attempt}/{max})", i + 1, attempts);
                if (i == attempts - 1) throw;
                await Task.Delay(delayMs);
                delayMs *= 2;
            }
        }

        if (response == null || !response.IsSuccessStatusCode)
        {
            string errMsg = response != null ? await response.Content.ReadAsStringAsync() : "Conexión fallida";
            _logger.LogError("El enrolamiento falló. Código: {code}, Respuesta: {response}", response?.StatusCode, errMsg);
            return string.Empty;
        }

        // Parse key from response
        string respBody = await response.Content.ReadAsStringAsync();
        using var respDoc = JsonDocument.Parse(respBody);
        string? apiKey = respDoc.RootElement.GetProperty("api_key").GetString();

        if (string.IsNullOrEmpty(apiKey))
        {
            _logger.LogError("El servidor no devolvió una clave de API.");
            return string.Empty;
        }

        // 3. Encrypt and persist with DPAPI
        PersistApiKey(apiKey);

        // 4. Remove enroll_token from config.json (discard secret)
        DiscardEnrollToken(configPath, rawConfig);

        _logger.LogInformation("Enrolamiento completado con éxito. Clave API persistida de forma segura.");
        return apiKey;
    }

    private void PersistApiKey(string apiKey)
    {
        try
        {
            var rawBytes = Encoding.UTF8.GetBytes(apiKey);
            var encryptedBytes = ProtectedData.Protect(rawBytes, null, DataProtectionScope.LocalMachine);
            File.WriteAllBytes(CredsFile, encryptedBytes);

            // Apply strict ACLs on the credential file
            var fileInfo = new FileInfo(CredsFile);
            var fileSecurity = fileInfo.GetAccessControl();
            fileSecurity.SetAccessRuleProtection(true, false);

            var systemSid = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
            fileSecurity.AddAccessRule(new FileSystemAccessRule(systemSid, FileSystemRights.FullControl, AccessControlType.Allow));

            var adminSid = new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null);
            fileSecurity.AddAccessRule(new FileSystemAccessRule(adminSid, FileSystemRights.FullControl, AccessControlType.Allow));

            fileInfo.SetAccessControl(fileSecurity);
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "Fallo crítico al persistir la credencial cifrada con DPAPI.");
            throw; // Re-throw so startup/enrollment flow fails loud and clear
        }
    }

    private void DiscardEnrollToken(string configPath, string rawConfig)
    {
        try
        {
            // Parse config.json to a JsonNode object tree
            var node = JsonNode.Parse(rawConfig)!.AsObject();
            
            // Remove token and api key safely, preserving other keys (arrays, decimals, etc.)
            node.Remove("enroll_token");
            node.Remove("api_key");

            var options = new JsonSerializerOptions { WriteIndented = true };
            File.WriteAllText(configPath, node.ToJsonString(options));
            _logger.LogInformation("Token de enrolamiento descartado y eliminado de {path}", configPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo limpiar el token del archivo config.json.");
        }
    }
}
