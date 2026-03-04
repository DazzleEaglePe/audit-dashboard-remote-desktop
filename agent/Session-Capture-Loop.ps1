<#
.SYNOPSIS
ECA Session Screenshot Capture Loop

.DESCRIPTION
This script runs inside each user's RDP session (triggered at logon).
It periodically captures the user's own screen and saves it to C:\ECA_Monitor\temp\
for the main agent to pick up and upload.
#>

$ErrorActionPreference = "SilentlyContinue"

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$tempDir = "C:\ECA_Monitor\temp"
$configFile = "C:\ECA_Monitor\config.json"
$intervalSeconds = 10

# Ensure temp directory exists
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
}

# Read config for interval
if (Test-Path $configFile) {
    try {
        $config = Get-Content $configFile | ConvertFrom-Json
        if ($config.screenshot_interval) {
            $intervalSeconds = $config.screenshot_interval
        }
    } catch {}
}

$username = $env:USERNAME
$sessionId = [System.Diagnostics.Process]::GetCurrentProcess().SessionId

while ($true) {
    try {
        $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        
        if ($bounds.Width -gt 0 -and $bounds.Height -gt 0) {
            # Capture full screen
            $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
            
            # Resize to thumbnail (640px wide)
            $thumbWidth = 640
            $thumbHeight = [math]::Round($bounds.Height * ($thumbWidth / $bounds.Width))
            $thumbnail = New-Object System.Drawing.Bitmap($thumbWidth, $thumbHeight)
            $thumbGraphics = [System.Drawing.Graphics]::FromImage($thumbnail)
            $thumbGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $thumbGraphics.DrawImage($bitmap, 0, 0, $thumbWidth, $thumbHeight)
            
            # Save as JPEG quality 70
            $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
            $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
            $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 70L)
            
            $outPath = Join-Path $tempDir "${username}_${sessionId}_thumb.jpg"
            $thumbnail.Save($outPath, $jpegCodec, $encoderParams)
            
            # Cleanup
            $thumbGraphics.Dispose()
            $thumbnail.Dispose()
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    } catch {
        # Silent fail - don't crash the loop
    }
    
    Start-Sleep -Seconds $intervalSeconds
}
