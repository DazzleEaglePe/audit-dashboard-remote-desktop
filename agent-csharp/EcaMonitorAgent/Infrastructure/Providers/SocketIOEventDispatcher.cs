using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using SocketIOClient;
using EcaMonitorAgent.Domain.Interfaces;
using EcaMonitorAgent.Domain.Models;

namespace EcaMonitorAgent.Infrastructure.Providers;

public class SocketIOEventDispatcher : IEventDispatcher
{
    private readonly SocketIO _client;
    private readonly HttpClient _httpClient;
    private readonly AgentConfig _config;
    private readonly ILogger<SocketIOEventDispatcher> _logger;

    public SocketIOEventDispatcher(AgentConfig config, ILogger<SocketIOEventDispatcher> logger)
    {
        _config = config;
        _logger = logger;
        
        // Use the domain root for SocketIO, not /api/
        var socketUrl = new Uri(_config.ApiUrl).GetLeftPart(UriPartial.Authority);
        
        var query = new System.Collections.Specialized.NameValueCollection();
        query.Add("server_id", _config.ServerId);

        _client = new SocketIO(new Uri(socketUrl), new SocketIOOptions
        {
            Path = "/socket.io",
            Query = query,
            ConnectionTimeout = TimeSpan.FromSeconds(10),
            Reconnection = true
        });

        _client.OnConnected += (sender, e) => _logger.LogInformation("Connected to WebSocket Dashboard.");
        _client.OnDisconnected += (sender, e) => _logger.LogWarning("Disconnected from WebSocket Dashboard.");

        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.Add("x-api-key", _config.ApiKey);
    }

    public async Task ConnectAsync()
    {
        try
        {
            await _client.ConnectAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to SocketIO server.");
        }
    }

    public async Task DisconnectAsync()
    {
        await _client.DisconnectAsync();
    }

    public async Task SendHeartbeatAsync(ServerMetrics metrics, IEnumerable<SessionInfo> sessions)
    {
        // For heartbeats, we keep using the REST API to stick to the current backend architecture
        var payload = new
        {
            server_id = _config.ServerId,
            hostname = metrics.Hostname,
            metrics = new
            {
                cpu_percent = metrics.CpuPercent,
                ram_used_mb = metrics.RamUsedMb,
                ram_total_mb = metrics.RamTotalMb,
                disk_percent = metrics.DiskPercent
            },
            sessions = sessions.Select(s => new
            {
                username = s.Username,
                session_id = s.SessionId,
                state = s.State,
                idle_time = s.IdleTime,
                logon_time = s.LogonTime,
                source_ip = s.SourceIp
            }).ToArray()
        };

        try
        {
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

            var response = await _httpClient.PostAsync($"{_config.ApiUrl}/agent/heartbeat", content);
            response.EnsureSuccessStatusCode();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send heartbeat via REST.");
        }
    }

    public async Task StreamFrameAsync(string serverId, string username, int sessionId, string base64Frame)
    {
        // Fast streaming over WebSocket
        if (!_client.Connected) return;

        try
        {
            var payload = new
            {
                server_id = serverId,
                username = username,
                session_id = sessionId,
                image_url = $"data:image/jpeg;base64,{base64Frame}",
                timestamp = DateTime.UtcNow.ToString("o")
            };

            await _client.EmitAsync("agent:screenshot", new object[] { payload });
        }
        catch (Exception ex)
        {
            _logger.LogTrace(ex, "Failed to emit frame.");
        }
    }
}
