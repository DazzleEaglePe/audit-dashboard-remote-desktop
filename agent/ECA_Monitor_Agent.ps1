<#
.SYNOPSIS
ECA Remote Monitor Agent

.DESCRIPTION
Gathers system metrics and active RDP sessions, sending them to the central Next.js dashboard.
Takes screenshots of active RDP sessions and uploads them.
#>

$ErrorActionPreference = "Stop"
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
    $cpu = Get-WmiObject Win32_Processor
    $total = 0
    foreach ($c in $cpu) { $total += $c.LoadPercentage }
    return [Math]::Round(($total / $cpu.Count), 1)
}

function Get-MemoryUsage {
    $os = Get-WmiObject Win32_OperatingSystem
    $totalMB = [Math]::Round($os.TotalVisibleMemorySize / 1024, 0)
    $freeMB = [Math]::Round($os.FreePhysicalMemory / 1024, 0)
    $usedMB = $totalMB - $freeMB
    return @{ Total = $totalMB; Used = $usedMB }
}

function Get-DiskUsage {
    $disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'"
    $totalGB = $disk.Size / 1GB
    $freeGB = $disk.FreeSpace / 1GB
    $usedGB = $totalGB - $freeGB
    $percent = ($usedGB / $totalGB) * 100
    return [Math]::Round($percent, 1)
}

function Get-RdpSessions {
    $sessions = @()
    # qwinsta output parsing
    $output = qwinsta
    $output | Select-Object -Skip 1 | ForEach-Object {
        $line = $_.Trim() -replace '\s+', ' '
        $parts = $line.Split(' ')
        
        # Valid user sessions usually have a USERNAME
        if ($parts.Length -ge 4 -and $parts[1] -match '^[a-zA-Z0-9_-]+$') {
            $username = $parts[1]
            $sessionId = $parts[2]
            $state = $parts[3]

            if ($state -eq 'Active' -or $state -eq 'Disc') {
                $status = if ($state -eq 'Active') { "Active" } else { "Disconnected" }
                $sessions += @{
                    username = $username
                    session_id = [int]$sessionId
                    state = $status
                    idle_time = ""
                    source_ip = "" # We could parse netstat for this
                }
            }
        }
    }
    return $sessions
}

Write-Host "Started ECA Monitor Agent for server $serverId"
Write-Host "Reporting to $apiUrl"

$lastScreenshotTime = [DateTime]::MinValue

while ($true) {
    # ─── 1. Heartbeat & Metrics ───
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
    
    # ─── 2. Screenshots (every screenshot_interval seconds) ───
    $now = Get-Date
    if (($now - $lastScreenshotTime).TotalSeconds -ge $config.screenshot_interval) {
        $lastScreenshotTime = $now
        
        $psexecPath = Join-Path $agentDir "psexec.exe"
        $captureScript = Join-Path $agentDir "Capture-Screenshot.ps1"
        $tempDir = Join-Path $agentDir "temp"
        
        if (Test-Path $psexecPath) {
            # Only screenshot 'Active' sessions
            $activeSessions = $sessions | Where-Object { $_.state -eq 'Active' }
            
            foreach ($session in $activeSessions) {
                $sessionId = $session.session_id
                $username = $session.username
                $thumbPath = Join-Path $tempDir "${username}_${sessionId}_thumb.jpg"
                
                try {
                    # Execute capture script inside the target user's session
                    $psexecArgs = "-accepteula", "-s", "-i", $sessionId, "-d", "powershell.exe", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", "`"$captureScript`"", "-OutPath", "`"$thumbPath`""
                    Start-Process -FilePath $psexecPath -ArgumentList $psexecArgs -WindowStyle Hidden -Wait | Out-Null
                    
                    # Give it a second to save the file
                    Start-Sleep -Seconds 1
                    
                    if (Test-Path $thumbPath) {
                        # Upload using curl.exe (built into Win10 1803+)
                        # PS 5.1 multipart form upload is complex, curl is robust
                        $curlArgs = @(
                            "-X", "POST",
                            "-H", "x-api-key: $apiKey",
                            "-F", "server_id=$serverId",
                            "-F", "username=$username",
                            "-F", "session_id=$sessionId",
                            "-F", "image=@$thumbPath",
                            "--silent", "--show-error",
                            "$apiUrl/agent/screenshot"
                        )
                        $curlOutput = & curl.exe @curlArgs
                        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Screenshot uploaded for $username ($sessionId)"
                        
                        # Cleanup
                        Remove-Item $thumbPath -Force
                    }
                }
                catch {
                    Write-Warning "[$(Get-Date -Format 'HH:mm:ss')] Failed to capture/upload screenshot for $username ($sessionId): $_"
                }
            }
        } else {
            Write-Warning "psexec.exe no se encontró en $agentDir. No se tomarán capturas."
        }
    }

    Start-Sleep -Seconds $intervalSeconds
}
