<#
.SYNOPSIS
ECA Remote Monitor Agent

.DESCRIPTION
Gathers system metrics and active RDP sessions, sending them to the central Next.js dashboard.
Takes screenshots of active RDP sessions and uploads them.
#>

$ErrorActionPreference = "Stop"

# Force TLS 1.2 for Invoke-RestMethod (fixes issues on Win10/PS5.1 connecting to modern HTTPS)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configFile = Join-Path $agentDir "config.json"

if (-not (Test-Path $configFile)) {
    Write-Error "Config file not found: $configFile"
    exit 1
}

$config = Get-Content $configFile | ConvertFrom-Json
$serverId = $config.server_id
$apiUrl = $config.api_url
$apiKey = $config.api_key
$intervalSeconds = $config.heartbeat_interval

$headers = @{
    "x-api-key" = $apiKey
    "Content-Type" = "application/json"
}

function Get-CpuUsage {
    try {
        $cpu = @(Get-WmiObject Win32_Processor -ErrorAction SilentlyContinue)
        if (-not $cpu -or $cpu.Count -eq 0) { return 0 }
        $total = 0
        foreach ($c in $cpu) { $total += $c.LoadPercentage }
        $count = $cpu.Count
        if ($count -eq 0) { return 0 }
        return [Math]::Round(($total / $count), 1)
    } catch { return 0 }
}

function Get-MemoryUsage {
    try {
        $os = Get-WmiObject Win32_OperatingSystem -ErrorAction SilentlyContinue
        if (-not $os -or $os.TotalVisibleMemorySize -eq 0) { return @{ Total = 0; Used = 0 } }
        $totalMB = [Math]::Round($os.TotalVisibleMemorySize / 1024, 0)
        $freeMB = [Math]::Round($os.FreePhysicalMemory / 1024, 0)
        $usedMB = $totalMB - $freeMB
        return @{ Total = $totalMB; Used = $usedMB }
    } catch { return @{ Total = 0; Used = 0 } }
}

function Get-DiskUsage {
    try {
        $disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction SilentlyContinue
        if (-not $disk -or $disk.Size -eq 0) { return 0 }
        $totalGB = $disk.Size / 1GB
        $freeGB = $disk.FreeSpace / 1GB
        $usedGB = $totalGB - $freeGB
        if ($totalGB -eq 0) { return 0 }
        $percent = ($usedGB / $totalGB) * 100
        return [Math]::Round($percent, 1)
    } catch { return 0 }
}

function Get-RdpSessions {
    $sessions = @()
    try {
        # quser output parsing - avoiding console flash using .NET Process
        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $pinfo.FileName = "quser.exe"
        $pinfo.UseShellExecute = $false
        $pinfo.RedirectStandardOutput = $true
        $pinfo.CreateNoWindow = $true
        $p = [System.Diagnostics.Process]::Start($pinfo)
        $output = $p.StandardOutput.ReadToEnd() -split "`n"
        $p.WaitForExit()
        
        if (-not $output) { return $sessions }
        
        $output | Select-Object -Skip 1 | ForEach-Object {
            $line = $_ -replace '^>', ''
            $line = $line.Trim() -replace '\s+', ' '
            $parts = $line -split ' '
            
            $username = $parts[0]
            $logonTime = ""
            $idleTime = ""
            $state = ""
            $sessionId = ""
            
            # Find the index of the connection state to anchor the parsing securely
            $stateIdx = -1
            for ($i = 0; $i -lt $parts.Length; $i++) {
                if ($parts[$i] -match '^(Active|Disc|Conn|Activo|Desc)$') {
                    $stateIdx = $i
                    break
                }
            }
            
            if ($stateIdx -gt 0) {
                $state = $parts[$stateIdx]
                $sessionId = $parts[$stateIdx - 1]
                
                if ($stateIdx + 1 -lt $parts.Length) {
                    $idleTime = $parts[$stateIdx + 1]
                    if ($idleTime -eq ".") { $idleTime = "0" } # . means active/no idle
                }
                
                if ($stateIdx + 2 -lt $parts.Length) {
                    $logonTimeRaw = $parts[($stateIdx + 2)..($parts.Length - 1)] -join " "
                    # Try to convert to ISO string for the frontend, fallback to raw
                    try {
                        $logonTimeDt = [datetime]::Parse($logonTimeRaw)
                        $logonTime = $logonTimeDt.ToString("yyyy-MM-ddTHH:mm:ss")
                    } catch {
                        $logonTime = $logonTimeRaw
                    }
                }
                
                # Check source IP (rudimentary check using netstat for port 3389 - optional extra)
                $sourceIp = ""
                
                if ($username -match '^[a-zA-Z0-9_\.\-]+$' -and $username -notmatch '^(services|console|65536)$') {
                    $isActive = $state -match '^(Active|Conn|Activo)$'
                    $isDisc = $state -match '^(Disc|Desc)$'
                    
                    if ($isActive -or $isDisc) {
                        $status = if ($isActive) { "Active" } else { "Disconnected" }
                        $sessions += @{
                            username = $username
                            session_id = [int]$sessionId
                            state = $status
                            idle_time = $idleTime
                            logon_time = $logonTime
                            source_ip = $sourceIp
                        }
                    }
                }
            }
        }
    } catch {
        Write-Warning "Error parsing quser: $_"
    }
    return $sessions
}

Write-Host "Started ECA Monitor Agent for server $serverId"
Write-Host "Reporting to $apiUrl"

$lastScreenshotTime = [DateTime]::MinValue

while ($true) {
    # --- 1. Heartbeat & Metrics ---
    try {
        $cpu = Get-CpuUsage
        $mem = Get-MemoryUsage
        $disk = Get-DiskUsage
        $sessions = Get-RdpSessions

        $payload = @{
            server_id = $serverId
            hostname = $env:COMPUTERNAME
            ip_lan = (Get-NetIPAddress -InterfaceAlias "Ethernet*" -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress
            ip_tailscale = (Get-NetIPAddress -InterfaceAlias "Tailscale*" -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress
            metrics = @{
                cpu_percent = $cpu
                ram_used_mb = $mem.Used
                ram_total_mb = $mem.Total
                disk_percent = $disk
            }
            sessions = $sessions
        }

        $jsonPayload = $payload | ConvertTo-Json -Depth 5 -Compress
        
        Invoke-RestMethod -Uri "$apiUrl/agent/heartbeat" -Method Post -Headers $headers -Body $jsonPayload -ErrorAction Stop | Out-Null
        
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Heartbeat sent successfully. (Sessions: $($sessions.Count), CPU: $cpu%)"
    }
    catch {
        Write-Warning "[$(Get-Date -Format 'HH:mm:ss')] Failed to send heartbeat: $_"
    }
    
    # --- 2. Screenshots: scan temp folder for captures from Session-Capture-Loop ---
    $now = Get-Date
    if (($now - $lastScreenshotTime).TotalSeconds -ge $config.screenshot_interval) {
        $lastScreenshotTime = $now
        
        $tempDir = Join-Path $agentDir "temp"
        if (-not (Test-Path $tempDir)) {
            New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
        }
        
        # Look for screenshot files placed by Session-Capture-Loop.ps1
        $thumbFiles = Get-ChildItem -Path $tempDir -Filter "*_thumb.jpg" -ErrorAction SilentlyContinue
        
        foreach ($file in $thumbFiles) {
            try {
                # Parse username and session ID from filename: username_sessionId_thumb.jpg
                $nameParts = $file.BaseName -replace '_thumb$', '' -split '_'
                if ($nameParts.Length -ge 2) {
                    $username = $nameParts[0..($nameParts.Length - 2)] -join '_'
                    $sessionId = $nameParts[-1]
                } else {
                    $username = $file.BaseName -replace '_thumb$', ''
                    $sessionId = "0"
                }
                
                # Upload using curl.exe via .NET Process to completely avoid console flashing
                $pinfo = New-Object System.Diagnostics.ProcessStartInfo
                $pinfo.FileName = "curl.exe"
                $pinfo.Arguments = "-s -F `"server_id=$serverId`" -F `"username=$username`" -F `"session_id=$sessionId`" -F `"image=@$($file.FullName)`" -H `"x-api-key: $apiKey`" `"$apiUrl/agent/screenshot`""
                $pinfo.UseShellExecute = $false
                $pinfo.CreateNoWindow = $true
                $p = [System.Diagnostics.Process]::Start($pinfo)
                $p.WaitForExit()
                
                if ($p.ExitCode -eq 0) {
                    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Screenshot uploaded for $username (session $sessionId) - curl exit: $($p.ExitCode)"
                } else {
                    Write-Warning "[$(Get-Date -Format 'HH:mm:ss')] Screenshot upload failed for $username (session $sessionId) - curl exit: $($p.ExitCode)"
                }
            }
            catch {
                Write-Warning "[$(Get-Date -Format 'HH:mm:ss')] Failed to upload screenshot $($file.Name): $_"
            }
        }
    }

    Start-Sleep -Seconds $intervalSeconds
}
