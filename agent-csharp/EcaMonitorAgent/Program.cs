using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.IO;
using System.Text.Json;
using EcaMonitorAgent.Application.Services;
using EcaMonitorAgent.Domain.Interfaces;
using EcaMonitorAgent.Domain.Models;
using EcaMonitorAgent.Infrastructure.Providers;

var builder = Host.CreateDefaultBuilder(args);

builder.ConfigureServices((hostContext, services) =>
{
    // Configure Logging
    services.AddLogging(configure =>
    {
        configure.AddSimpleConsole(options => 
        {
            options.IncludeScopes = false;
            options.SingleLine = true;
            options.TimestampFormat = "yyyy-MM-dd HH:mm:ss ";
        });
        configure.SetMinimumLevel(LogLevel.Debug);
    });

    // Load Configuration from the standard ECA_Monitor config file
    var configPath = @"C:\ECA_Monitor\config.json";
    if (!File.Exists(configPath))
    {
        Console.WriteLine($"[ERROR] Configuration file not found at: {configPath}");
        return;
    }

    var jsonString = File.ReadAllText(configPath);
    var jsonDoc = JsonDocument.Parse(jsonString);
    var root = jsonDoc.RootElement;

    var agentConfig = new AgentConfig
    {
        ServerId = root.TryGetProperty("server_id", out var sid) ? sid.GetString() ?? "srv1" : "srv1",
        ApiUrl = root.TryGetProperty("api_url", out var aurl) ? aurl.GetString() ?? "https://dashboard.ecabot.site/api" : "https://dashboard.ecabot.site/api",
        ApiKey = root.TryGetProperty("api_key", out var akey) ? akey.GetString() ?? "" : "",
        HeartbeatIntervalSeconds = root.TryGetProperty("heartbeat_interval", out var hb) ? hb.GetInt32() : 30,
        ScreenshotIntervalMs = 200, // Fixed 5 fps for C# streaming
        ScreenshotQuality = 60
    };

    services.AddSingleton(agentConfig);

    // Register Infrastructure Services
    services.AddSingleton<IMetricsRecorder, NativeMetricsRecorder>();
    services.AddSingleton<ISessionProvider, NativeSessionProvider>();
    services.AddSingleton<IScreenCaptureEngine, DrawingCaptureEngine>();
    services.AddSingleton<IEventDispatcher, SocketIOEventDispatcher>();

    // Register Application Worker
    services.AddHostedService<MonitorWorker>();
});

using var host = builder.Build();

Console.WriteLine("=============================================");
Console.WriteLine(" ECA Monitor C# Agent - Real-time Streaming  ");
Console.WriteLine("=============================================");
Console.WriteLine("Press Ctrl+C to exit...\n");

await host.RunAsync();
