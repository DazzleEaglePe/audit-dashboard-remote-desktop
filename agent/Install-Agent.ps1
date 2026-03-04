<#
.SYNOPSIS
Instalador del Agente de Monitoreo ECA
#>

$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TargetDir = "C:\ECA_Monitor"

Write-Host "Instalando ECA Monitor Agent..."

# Crear directorio base
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir | Out-Null
}

$TempDir = Join-Path $TargetDir "temp"
if (-not (Test-Path $TempDir)) {
    New-Item -ItemType Directory -Path $TempDir | Out-Null
}

# Copiar archivos
Copy-Item (Join-Path $SourceDir "ECA_Monitor_Agent.ps1") $TargetDir -Force
Copy-Item (Join-Path $SourceDir "Capture-Screenshot.ps1") $TargetDir -Force
Copy-Item (Join-Path $SourceDir "config.json") $TargetDir -Force

Write-Host "Archivos copiados a $TargetDir"

# Crear Tarea Programada para auto-inicio
$TaskName = "ECA_Monitor_Heartbeat"
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File C:\ECA_Monitor\ECA_Monitor_Agent.ps1"
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Force | Out-Null

Write-Host "Tarea programada $TaskName creada con éxito."
Write-Host "Para iniciar el agente ahora mismo:"
Write-Host "Start-ScheduledTask -TaskName $TaskName"
Write-Host "Instalación completada."
