using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using EcaMonitorAgent.Domain.Interfaces;
using EcaMonitorAgent.Domain.Models;

namespace EcaMonitorAgent.Infrastructure.Providers;

public class NativeSessionProvider : ISessionProvider
{
    private const int WTS_CURRENT_SERVER_HANDLE = 0;

    [DllImport("wtsapi32.dll", SetLastError = true)]
    private static extern bool WTSEnumerateSessions(
        IntPtr hServer,
        int Reserved,
        int Version,
        ref IntPtr ppSessionInfo,
        ref int pCount);

    [DllImport("wtsapi32.dll")]
    private static extern void WTSFreeMemory(IntPtr pMemory);

    [DllImport("wtsapi32.dll", SetLastError = true)]
    private static extern bool WTSQuerySessionInformation(
        IntPtr hServer,
        int sessionId,
        WTS_INFO_CLASS wtsInfoClass,
        out IntPtr ppBuffer,
        out uint pBytesReturned);

    private enum WTS_INFO_CLASS
    {
        WTSUserName = 5,
        WTSClientAddress = 14,
        WTSIdleTime = 16,
        WTSLogonTime = 17,
        WTSWinStationName = 1
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WTS_SESSION_INFO
    {
        public int SessionID;
        public string pWinStationName;
        public WTS_CONNECTSTATE_CLASS State;
    }

    private enum WTS_CONNECTSTATE_CLASS
    {
        WTSActive,
        WTSConnected,
        WTSConnectQuery,
        WTSShadow,
        WTSDisconnected,
        WTSIdle,
        WTSListen,
        WTSReset,
        WTSDown,
        WTSInit
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WTS_CLIENT_ADDRESS
    {
        public int AddressFamily;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 20)]
        public byte[] Address;
    }

    public IEnumerable<SessionInfo> GetActiveSessions()
    {
        var sessions = new List<SessionInfo>();
        IntPtr ppSessionInfo = IntPtr.Zero;
        int count = 0;

        if (WTSEnumerateSessions((IntPtr)WTS_CURRENT_SERVER_HANDLE, 0, 1, ref ppSessionInfo, ref count))
        {
            var dataSize = Marshal.SizeOf(typeof(WTS_SESSION_INFO));
            var current = ppSessionInfo;

            for (int i = 0; i < count; i++)
            {
                var sessionInfo = (WTS_SESSION_INFO)Marshal.PtrToStructure(current, typeof(WTS_SESSION_INFO))!;
                current += dataSize;

                // Ignore Session 0 (Services) and Listener Sessions (RDP-Tcp)
                if (sessionInfo.SessionID == 0 || sessionInfo.State == WTS_CONNECTSTATE_CLASS.WTSListen)
                    continue;

                var username = GetSessionStringInfo(sessionInfo.SessionID, WTS_INFO_CLASS.WTSUserName);
                if (string.IsNullOrWhiteSpace(username)) continue;

                var state = sessionInfo.State switch
                {
                    WTS_CONNECTSTATE_CLASS.WTSActive => "Active",
                    WTS_CONNECTSTATE_CLASS.WTSDisconnected => "Disconnected",
                    WTS_CONNECTSTATE_CLASS.WTSIdle => "Idle",
                    _ => "Disconnected"
                };

                // Parse Idle Time
                long idleTimeRaw = GetSessionLongInfo(sessionInfo.SessionID, WTS_INFO_CLASS.WTSIdleTime);
                var idleTimeSpan = new TimeSpan((idleTimeRaw * 10) * 1000); // from ms/100 to ticks
                var idleTimeString = idleTimeSpan.TotalMinutes > 0 ? $"{(int)idleTimeSpan.TotalMinutes} min" : "0";

                sessions.Add(new SessionInfo
                {
                    SessionId = sessionInfo.SessionID,
                    Username = username.ToLower(),
                    State = state,
                    IdleTime = idleTimeString,
                    LogonTime = GetSessionLogonTime(sessionInfo.SessionID),
                    SourceIp = GetSessionIp(sessionInfo.SessionID)
                });
            }

            WTSFreeMemory(ppSessionInfo);
        }

        return sessions;
    }

    public bool IsDesktopActive(int sessionId)
    {
        // Screen capture only works on Active sessions.
        // We can do further checks here if needed (e.g. check if screen is locked)
        return true; 
    }

    private string GetSessionStringInfo(int sessionId, WTS_INFO_CLASS infoClass)
    {
        if (WTSQuerySessionInformation((IntPtr)WTS_CURRENT_SERVER_HANDLE, sessionId, infoClass, out IntPtr buffer, out uint bytesReturned))
        {
            var result = Marshal.PtrToStringAnsi(buffer);
            WTSFreeMemory(buffer);
            return result ?? string.Empty;
        }
        return string.Empty;
    }

    private string GetSessionLogonTime(int sessionId)
    {
        long fileTime = GetSessionLongInfo(sessionId, WTS_INFO_CLASS.WTSLogonTime);
        if (fileTime <= 0) return string.Empty;
        
        try
        {
            var dt = DateTime.FromFileTime(fileTime);
            return dt.ToString("o"); // ISO8601
        }
        catch { return string.Empty; }
    }

    private long GetSessionLongInfo(int sessionId, WTS_INFO_CLASS infoClass)
    {
        if (WTSQuerySessionInformation((IntPtr)WTS_CURRENT_SERVER_HANDLE, sessionId, infoClass, out IntPtr buffer, out uint bytesReturned))
        {
            var result = Marshal.ReadInt64(buffer);
            WTSFreeMemory(buffer);
            return result;
        }
        return 0;
    }

    private string GetSessionIp(int sessionId)
    {
        if (WTSQuerySessionInformation((IntPtr)WTS_CURRENT_SERVER_HANDLE, sessionId, WTS_INFO_CLASS.WTSClientAddress, out IntPtr buffer, out uint bytesReturned))
        {
            var wtsClientAddress = (WTS_CLIENT_ADDRESS)Marshal.PtrToStructure(buffer, typeof(WTS_CLIENT_ADDRESS))!;
            WTSFreeMemory(buffer);

            if (wtsClientAddress.AddressFamily == (int)AddressFamily.InterNetwork) // IPv4 = 2
            {
                var ipBytes = wtsClientAddress.Address.Skip(2).Take(4).ToArray();
                return new IPAddress(ipBytes).ToString();
            }
        }
        return string.Empty;
    }
}
