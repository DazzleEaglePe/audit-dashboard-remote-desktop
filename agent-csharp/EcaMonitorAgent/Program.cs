using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using EcaMonitorAgent.Application.Services;
using EcaMonitorAgent.Domain.Interfaces;
using EcaMonitorAgent.Domain.Models;
using EcaMonitorAgent.Infrastructure.Providers;

namespace EcaMonitorAgent;

internal static class Program
{
    static async Task Main(string[] args)
    {
        var configPath = AgentConfig.DefaultConfigPath;
        if (!File.Exists(configPath))
        {
            throw new FileNotFoundException($"El archivo de configuración obligatorio no existe: {configPath}");
        }

        // Initialize temp logging to show enrollment progress on console
        using var loggerFactory = LoggerFactory.Create(builder =>
        {
            builder.AddConsole();
            builder.SetMinimumLevel(LogLevel.Information);
        });
        var logger = loggerFactory.CreateLogger("AgentStartup");

        logger.LogInformation("Cargando configuración básica de {path}", configPath);
        var jsonString = File.ReadAllText(configPath);
        using var jsonDoc = JsonDocument.Parse(jsonString);
        var root = jsonDoc.RootElement;

        var agentConfig = new AgentConfig
        {
            ServerId = "placeholder", // Will be resolved dynamically
            ApiUrl = root.TryGetProperty("api_url", out var aurl) ? aurl.GetString() ?? "https://dashboard.ecabot.site/api" : "https://dashboard.ecabot.site/api",
            ApiKey = "placeholder",   // Will be resolved dynamically
            HeartbeatIntervalSeconds = root.TryGetProperty("heartbeat_interval", out var hb) ? hb.GetInt32() : 30,
            ScreenshotIntervalMs = 200,
            ScreenshotQuality = 60
        };

        // Execute enrollment manager
        var enrollLogger = loggerFactory.CreateLogger<EnrollmentManager>();
        var enrollmentManager = new EnrollmentManager(agentConfig, enrollLogger);

        try
        {
            await enrollmentManager.InitializeAndEnrollAsync(configPath);
            logger.LogInformation("Agent initialized with ServerId: {guid}", agentConfig.ServerId);
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            logger.LogCritical(ex, "Error crítico durante el enrolamiento del agente.");
            Console.ResetColor();
            return;
        }

        var builder = Host.CreateDefaultBuilder(args);
        builder.UseWindowsService(options =>
        {
            options.ServiceName = "EcaMonitorAgent";
        });

        builder.ConfigureServices((hostContext, services) =>
        {
            services.AddLogging(configure =>
            {
                configure.SetMinimumLevel(LogLevel.Warning);
                configure.AddConsole();
                configure.AddEventLog(options =>
                {
                    options.SourceName = "EcaMonitorAgent";
                });
            });

            services.AddSingleton(agentConfig);
            services.AddSingleton(enrollmentManager); // Inject so background worker can trigger re-enrollment if needed
            services.AddSingleton<IMetricsRecorder, NativeMetricsRecorder>();
            services.AddSingleton<ISessionProvider, NativeSessionProvider>();
            services.AddSingleton<IScreenCaptureEngine, DrawingCaptureEngine>();
            services.AddSingleton<IEventDispatcher, SocketIOEventDispatcher>();
            services.AddHostedService<MonitorWorker>();
        });

        using var host = builder.Build();
        await host.RunAsync();
    }
}
