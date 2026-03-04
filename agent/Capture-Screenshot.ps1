<#
.SYNOPSIS
ECA Session Screenshot Capturer

.DESCRIPTION
This script is designed to be executed inside a specific user's session (e.g., via PsExec -i <SessionID> -s).
It captures the primary screen, resizes it to a thumbnail, and saves it as a JPEG file.

.EXAMPLE
.\Capture-Screenshot.ps1 -OutPath "C:\ECA_Monitor\temp\username_1_thumb.jpg"
#>

param (
    [Parameter(Mandatory=$true)]
    [string]$OutPath
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

# Get primary screen bounds
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds

# Create bitmap objects
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

try {
    # Capture the screen
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

    # Resize to thumbnail (640x360 approx) to save bandwidth
    $thumbWidth = 640
    $thumbHeight = [math]::Round($bounds.Height * ($thumbWidth / $bounds.Width))
    $thumbnail = new-object System.Drawing.Bitmap($thumbWidth, $thumbHeight)
    $thumbGraphics = [System.Drawing.Graphics]::FromImage($thumbnail)
    
    # High quality resize
    $thumbGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $thumbGraphics.DrawImage($bitmap, 0, 0, $thumbWidth, $thumbHeight)

    # Save as JPEG with custom quality parameters
    $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 70L)

    $thumbnail.Save($OutPath, $jpegCodec, $encoderParams)
    
    Write-Host "Screenshot saved to $OutPath"
} catch {
    Write-Error "Failed to capture screenshot: $_"
} finally {
    if ($thumbGraphics) { $thumbGraphics.Dispose() }
    if ($thumbnail) { $thumbnail.Dispose() }
    if ($graphics) { $graphics.Dispose() }
    if ($bitmap) { $bitmap.Dispose() }
}
