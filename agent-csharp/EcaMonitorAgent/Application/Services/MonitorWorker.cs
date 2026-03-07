using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using EcaMonitorAgent.Domain.Interfaces;
using EcaMonitorAgent.Domain.Models;

namespace EcaMonitorAgent.Application.Services;

public class MonitorWorker : BackgroundService
{
    private readonly ILogger<MonitorWorker> _logger;
    private readonly ISessionProvider _sessionProvider;
    private readonly IMetricsRecorder _metricsRecorder;
    private readonly IScreenCaptureEngine _captureEngine;
    private readonly IEventDispatcher _eventDispatcher;
    private readonly AgentConfig _config;

    public MonitorWorker(
        ILogger<MonitorWorker> logger,
        ISessionProvider sessionProvider,
        IMetricsRecorder metricsRecorder,
        IScreenCaptureEngine captureEngine,
        IEventDispatcher eventDispatcher,
        AgentConfig config)
    {
        _logger = logger;
        _sessionProvider = sessionProvider;
        _metricsRecorder = metricsRecorder;
        _captureEngine = captureEngine;
        _eventDispatcher = eventDispatcher;
        _config = config;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ECA Monitor Agent started. Connecting to Dispatcher...");
        
        await _eventDispatcher.ConnectAsync();

        // Run Heartbeat and Screen Streaming in parallel
        var heartbeatTask = RunHeartbeatLoopAsync(stoppingToken);
        var streamingTask = RunStreamingLoopAsync(stoppingToken);

        await Task.WhenAll(heartbeatTask, streamingTask);
        
        await _eventDispatcher.DisconnectAsync();
    }

    private async Task RunHeartbeatLoopAsync(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            try
            {
                var metrics = _metricsRecorder.GetCurrentMetrics();
                var sessions = _sessionProvider.GetActiveSessions();

                await _eventDispatcher.SendHeartbeatAsync(metrics, sessions);
                _logger.LogDebug("Heartbeat sent successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Heartbeat loop.");
            }

            await Task.Delay(TimeSpan.FromSeconds(_config.HeartbeatIntervalSeconds), token);
        }
    }

    private async Task RunStreamingLoopAsync(CancellationToken token)
    {
        // Get the session ID of the CURRENT PROCESS — guaranteed to match the correct RDP session
        var mySessionId = System.Diagnostics.Process.GetCurrentProcess().SessionId;
        var currentUser = Environment.UserName;
        _logger.LogInformation("Streaming loop started. Process SessionId={SessionId}, User={User}", mySessionId, currentUser);

        int frameCount = 0;

        while (!token.IsCancellationRequested)
        {
            try
            {
                var frame = _captureEngine.CaptureSessionAsBase64(
                    mySessionId,
                    _config.ThumbnailWidth,
                    _config.ThumbnailHeight,
                    _config.ScreenshotQuality);

                if (!string.IsNullOrEmpty(frame))
                {
                    await _eventDispatcher.StreamFrameAsync(
                        _config.ServerId,
                        currentUser,
                        mySessionId,
                        frame);

                    frameCount++;
                    if (frameCount % 25 == 0) // Log every 5 seconds (25 frames at 5fps)
                    {
                        _logger.LogDebug("Streaming: {Count} frames sent so far.", frameCount);
                    }
                }
                else if (frameCount == 0)
                {
                    _logger.LogWarning("CaptureSessionAsBase64 returned null for SessionId={SessionId}.", mySessionId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Streaming loop.");
            }

            // Target frame rate (e.g. 5 FPS = 200ms delay)
            await Task.Delay(_config.ScreenshotIntervalMs, token);
        }
    }
}
