using System.Diagnostics;
using System.Management;
using EcaMonitorAgent.Domain.Interfaces;
using EcaMonitorAgent.Domain.Models;

namespace EcaMonitorAgent.Infrastructure.Providers;

public class NativeMetricsRecorder : IMetricsRecorder
{
    private readonly AgentConfig _config;
    private readonly PerformanceCounter? _cpuCounter;
    private readonly ulong _totalRamMb;

    public NativeMetricsRecorder(AgentConfig config)
    {
        _config = config;
        try
        {
            _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
            _cpuCounter.NextValue(); // First call always returns 0
        }
        catch
        {
            _cpuCounter = null;
        }

        _totalRamMb = GetTotalMemoryMb();
    }

    public ServerMetrics GetCurrentMetrics()
    {
        // CPU
        double cpuPercent = 0;
        if (_cpuCounter != null)
        {
            try
            {
                cpuPercent = Math.Round(_cpuCounter.NextValue(), 2);
            }
            catch
            {
                cpuPercent = GetCpuUsageFallback();
            }
        }
        else
        {
            cpuPercent = GetCpuUsageFallback();
        }

        // RAM
        var availableRamMb = GetAvailableMemoryMb();
        var usedRamMb = _totalRamMb > 0 && _totalRamMb > availableRamMb ? _totalRamMb - availableRamMb : 0;

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

    private double GetCpuUsageFallback()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT LoadPercentage FROM Win32_Processor");
            foreach (ManagementObject obj in searcher.Get())
            {
                if (obj["LoadPercentage"] != null && ushort.TryParse(obj["LoadPercentage"]?.ToString(), out ushort pct))
                {
                    return pct;
                }
            }
        }
        catch { /* fallback */ }
        return 0;
    }

    private ulong GetTotalMemoryMb()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT TotalPhysicalMemory FROM Win32_ComputerSystem");
            foreach (ManagementObject obj in searcher.Get())
            {
                if (obj["TotalPhysicalMemory"] != null && ulong.TryParse(obj["TotalPhysicalMemory"]?.ToString(), out ulong bytes))
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
        // Try performance counter first
        try
        {
            using var counter = new PerformanceCounter("Memory", "Available MBytes");
            return (ulong)counter.NextValue();
        }
        catch
        {
            // Try WMI fallback
            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT FreePhysicalMemory FROM Win32_OperatingSystem");
                foreach (ManagementObject obj in searcher.Get())
                {
                    if (obj["FreePhysicalMemory"] != null && ulong.TryParse(obj["FreePhysicalMemory"]?.ToString(), out ulong freeKb))
                    {
                        return freeKb / 1024;
                    }
                }
            }
            catch { /* fallback */ }
            return 0;
        }
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
