using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.IO;
using System.Text.Json;
using EcaMonitorAgent.Application.Services;
using EcaMonitorAgent.Domain.Interfaces;
using EcaMonitorAgent.Domain.Models;
using EcaMonitorAgent.Infrastructure.Providers;

namespace EcaMonitorAgent;

internal static class Program
{
    static async Task Main(string[] args)
    {
        var builder = Host.CreateDefaultBuilder(args);

        builder.ConfigureServices((hostContext, services) =>
        {
            services.AddLogging(configure =>
            {
                configure.SetMinimumLevel(LogLevel.Warning);
            });

            // Load Configuration
            var configPath = @"C:\ECA_Monitor\config.json";
            if (!File.Exists(configPath))
                return;

            var jsonString = File.ReadAllText(configPath);
            var jsonDoc = JsonDocument.Parse(jsonString);
            var root = jsonDoc.RootElement;

            var agentConfig = new AgentConfig
            {
                ServerId = root.TryGetProperty("server_id", out var sid) ? sid.GetString() ?? "srv1" : "srv1",
                ApiUrl = root.TryGetProperty("api_url", out var aurl) ? aurl.GetString() ?? "https://dashboard.ecabot.site/api" : "https://dashboard.ecabot.site/api",
                ApiKey = root.TryGetProperty("api_key", out var akey) ? akey.GetString() ?? "" : "",
                HeartbeatIntervalSeconds = root.TryGetProperty("heartbeat_interval", out var hb) ? hb.GetInt32() : 30,
                ScreenshotIntervalMs = 200,
                ScreenshotQuality = 60
            };

            services.AddSingleton(agentConfig);
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
