namespace EcaMonitorAgent.Domain.Models;

public class ServerMetrics
{
    public required string ServerId { get; set; }
    public required string Hostname { get; set; }
    public double CpuPercent { get; set; }
    public double RamUsedMb { get; set; }
    public double RamTotalMb { get; set; }
    public double DiskPercent { get; set; }
}

public class SessionInfo
{
    public required string Username { get; set; }
    public int SessionId { get; set; }
    public required string State { get; set; }
    public required string IdleTime { get; set; }
    public required string LogonTime { get; set; }
    public required string SourceIp { get; set; }
}

public class AgentConfig
{
    public required string ServerId { get; set; }
    public required string ApiUrl { get; set; }
    public required string ApiKey { get; set; }
    public int HeartbeatIntervalSeconds { get; set; } = 30;
    public int ScreenshotIntervalMs { get; set; } = 200; // 5 FPS
    public int ThumbnailWidth { get; set; } = 640;
    public int ThumbnailHeight { get; set; } = 360;
    public int ScreenshotQuality { get; set; } = 70;
}
