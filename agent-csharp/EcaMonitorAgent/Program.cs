using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.IO;
using System.Text.Json;
using System.Windows.Forms;
using EcaMonitorAgent.Application.Services;
using EcaMonitorAgent.Domain.Interfaces;
using EcaMonitorAgent.Domain.Models;
using EcaMonitorAgent.Infrastructure.Providers;

// Required for NotifyIcon message pump
System.Windows.Forms.Application.EnableVisualStyles();
System.Windows.Forms.Application.SetCompatibleTextRenderingDefault(false);

var builder = Host.CreateDefaultBuilder(args);

builder.ConfigureServices((hostContext, services) =>
{
    // Configure Logging (no console output since we're a tray app)
    services.AddLogging(configure =>
    {
        configure.SetMinimumLevel(LogLevel.Debug);
    });

    // Load Configuration from the standard ECA_Monitor config file
    var configPath = @"C:\ECA_Monitor\config.json";
    if (!File.Exists(configPath))
    {
        MessageBox.Show($"Config not found: {configPath}", "ECA Monitor", MessageBoxButtons.OK, MessageBoxIcon.Error);
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

// --- System Tray Icon ---
var trayMenu = new ContextMenuStrip();
trayMenu.Items.Add("ECA Monitor (Activo)", null, null!).Enabled = false;
trayMenu.Items.Add(new ToolStripSeparator());
trayMenu.Items.Add("Salir", null, (_, _) =>
{
    host.StopAsync().Wait(TimeSpan.FromSeconds(3));
    System.Windows.Forms.Application.Exit();
});

var trayIcon = new NotifyIcon
{
    Text = "ECA Monitor Agent - Streaming",
    Icon = SystemIcons.Shield,
    ContextMenuStrip = trayMenu,
    Visible = true
};

// Start the host (heartbeat + streaming) in a background thread
var hostTask = Task.Run(() => host.RunAsync());

// Run WinForms message pump on main thread (keeps tray icon alive)
System.Windows.Forms.Application.Run();

// Cleanup
trayIcon.Visible = false;
trayIcon.Dispose();

