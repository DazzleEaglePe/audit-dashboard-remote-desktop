namespace EcaMonitorAgent.Domain.Interfaces;

using EcaMonitorAgent.Domain.Models;

public interface IMetricsRecorder
{
    ServerMetrics GetCurrentMetrics();
}

public interface ISessionProvider
{
    IEnumerable<SessionInfo> GetActiveSessions();
    bool IsDesktopActive(int sessionId);
}

public interface IScreenCaptureEngine
{
    /// <summary>
    /// Captures the screen for a specific session and returns it as a Base64 JPEG string.
    /// Returns null if the session is locked or capture fails.
    /// </summary>
    string? CaptureSessionAsBase64(int sessionId, int width, int height, int quality);
}

public interface IEventDispatcher
{
    Task ConnectAsync();
    Task DisconnectAsync();
    
    // REST fallback for heartbeat when WebSocket is unstable
    Task SendHeartbeatAsync(ServerMetrics metrics, IEnumerable<SessionInfo> sessions);
    
    // WebSocket streaming for screenshots
    Task StreamFrameAsync(string serverId, string username, int sessionId, string base64Frame);
}
