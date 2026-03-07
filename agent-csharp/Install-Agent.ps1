<#
.SYNOPSIS
    Instala el Agente C# de ECA Monitor como Tarea Programada en el Servidor.

.DESCRIPTION
    Coloca este script (.ps1) junto al ejecutable (EcaMonitorAgent.exe) en la misma
    carpeta dentro del Servidor, haz clic derecho -> "Ejecutar con PowerShell".
#>

param (
    [string]$TargetFolder = "C:\ECA_Monitor_CSharp",
    [string]$ApiKey = "ebccaeb3-2ebd-49ea-950c-e87f1fb5ca42" # Reemplaza con tu token real
)

# --- Verificar Permisos de Administrador ---
if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Este script necesita permisos de Administrador para instalar el agente."
    Write-Warning "Por favor, abre PowerShell como Administrador e intenta de nuevo."
    try {
        Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    } catch {
        Write-Host "No se pudo elevar los privilegios automáticamente." -ForegroundColor Red
    }
    exit
}
# ---------------------------------------------

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " Instalador ECA Monitor Agent (C#)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# 1. Verificar ejecutable local
$sourceExe = Join-Path $PSScriptRoot "EcaMonitorAgent.exe"

if (!(Test-Path $sourceExe)) {
    Write-Host "[ERROR] No se encuentra EcaMonitorAgent.exe junto a este script." -ForegroundColor Red
    Write-Host "Por favor, asegúrate de haber copiado el .exe a esta misma carpeta." -ForegroundColor Yellow
    Pause
    exit
}

# 2. Copiar archivos
Write-Host "`n[1/2] Copiando ejecutable a $TargetFolder..." -ForegroundColor Yellow
if (!(Test-Path $TargetFolder)) {
    New-Item -ItemType Directory -Force -Path $TargetFolder | Out-Null
}

Copy-Item -Path $sourceExe -Destination $TargetFolder -Force

# Guardar API Key como variable de entorno de sistema
[Environment]::SetEnvironmentVariable("ECA_API_KEY", $ApiKey, "Machine")

# 3. Crear Tarea Programada
Write-Host "`n[2/2] Creando Tarea Programada (Ejecutable al Inicio de Sesión)..." -ForegroundColor Yellow
$taskName = "ECA_Monitor_Agent_CSharp"

# Limpiar tarea vieja si existe
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$taskAction = New-ScheduledTaskAction -Execute "$TargetFolder\EcaMonitorAgent.exe"
# Ejecutar cuando CUALQUIER usuario inicie sesión (para capturar sus pantallas)
$taskTrigger = New-ScheduledTaskTrigger -AtLogOn
# Nota: Quitamos -DontStopOnIdleSystem para mayor compatibilidad con Windows más antiguos
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Days 1000)

Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Description "Agente C# de ECA Monitor para capturas a 5 FPS" -Force | Out-Null

Write-Host "`n¡Instalación completada con éxito!" -ForegroundColor Green
Write-Host "El agente se ejecutará automáticamente cuando los usuarios inicien sesión (o se conecten por RDP)."
Write-Host "Para iniciar el monitoreo AHORA MISMO en esta sesión, ejecuta:"
Write-Host "$TargetFolder\EcaMonitorAgent.exe`n" -ForegroundColor Cyan
Pause
