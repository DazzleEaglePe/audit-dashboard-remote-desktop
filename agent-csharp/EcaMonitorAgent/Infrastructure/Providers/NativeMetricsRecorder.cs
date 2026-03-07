using System.Diagnostics;
using System.Management;
using EcaMonitorAgent.Domain.Interfaces;
using EcaMonitorAgent.Domain.Models;

namespace EcaMonitorAgent.Infrastructure.Providers;

public class NativeMetricsRecorder : IMetricsRecorder
{
    private readonly AgentConfig _config;
    private readonly PerformanceCounter _cpuCounter;
    private readonly ulong _totalRamMb;

    public NativeMetricsRecorder(AgentConfig config)
    {
        _config = config;
        _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
        _cpuCounter.NextValue(); // First call always returns 0

        _totalRamMb = GetTotalMemoryMb();
    }

    public ServerMetrics GetCurrentMetrics()
    {
        // CPU
        var cpuPercent = Math.Round(_cpuCounter.NextValue(), 2);

        // RAM
        var availableRamMb = GetAvailableMemoryMb();
        var usedRamMb = _totalRamMb > 0 ? _totalRamMb - availableRamMb : 0;

        // Disk (C:)
        var diskPercent = GetDiskUsagePercent("C:\\") ?? 0;

        return new ServerMetrics
        {
            ServerId = _config.ServerId,
            Hostname = Environment.MachineName,
            CpuPercent = cpuPercent,
            RamTotalMb = _totalRamMb,
            RamUsedMb = usedRamMb,
            DiskPercent = diskPercent
        };
    }

    private ulong GetTotalMemoryMb()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT TotalPhysicalMemory FROM Win32_ComputerSystem");
            foreach (ManagementObject obj in searcher.Get())
            {
                if (ulong.TryParse(obj["TotalPhysicalMemory"]?.ToString(), out ulong bytes))
                {
                    return bytes / (1024 * 1024);
                }
            }
        }
        catch { /* fallback */ }
        return 0;
    }

    private ulong GetAvailableMemoryMb()
    {
        try
        {
            using var counter = new PerformanceCounter("Memory", "Available MBytes");
            return (ulong)counter.NextValue();
        }
        catch { return 0; }
    }

    private double? GetDiskUsagePercent(string driveName)
    {
        try
        {
            var drive = DriveInfo.GetDrives().FirstOrDefault(d => 
                d.Name.StartsWith(driveName, StringComparison.OrdinalIgnoreCase));
            
            if (drive != null && drive.IsReady)
            {
                var total = drive.TotalSize;
                var free = drive.AvailableFreeSpace;
                var used = total - free;
                return Math.Round((double)used / total * 100, 2);
            }
        }
        catch { /* fallback */ }
        return null;
    }
}
