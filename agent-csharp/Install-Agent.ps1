<#
.SYNOPSIS
    Instala el Agente C# de ECA Monitor como Tarea Programada en el Servidor.

.DESCRIPTION
    Coloca este script (.ps1) junto al ejecutable (EcaMonitorAgent.exe) en la misma
    carpeta dentro del Servidor (ej. C:\ECA_Monitor\agent-csharp\),
    haz clic derecho -> "Ejecutar con PowerShell".

    Requisito: C:\ECA_Monitor\config.json debe existir con server_id y api_key.
#>

param (
    [string]$TargetFolder = "C:\ECA_Monitor\agent-csharp"
)

# --- Verificar Permisos de Administrador ---
if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Este script necesita permisos de Administrador."
    try {
        Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    } catch {
        Write-Host "No se pudo elevar los privilegios automaticamente." -ForegroundColor Red
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
    Pause
    exit
}

# 2. Verificar config.json
$configPath = "C:\ECA_Monitor\config.json"
if (!(Test-Path $configPath)) {
    Write-Host "[ERROR] No se encuentra config.json en C:\ECA_Monitor\" -ForegroundColor Red
    Write-Host "Crea el archivo con server_id, api_url y api_key." -ForegroundColor Yellow
    Pause
    exit
}

# 3. Copiar ejecutable
Write-Host "`n[1/3] Copiando ejecutable a $TargetFolder..." -ForegroundColor Yellow
if (!(Test-Path $TargetFolder)) {
    New-Item -ItemType Directory -Force -Path $TargetFolder | Out-Null
}
Copy-Item -Path $sourceExe -Destination $TargetFolder -Force

# 4. Detener agente PowerShell viejo (si existe)
Write-Host "`n[2/3] Deshabilitando agente PowerShell antiguo..." -ForegroundColor Yellow
$oldTask = Get-ScheduledTask -TaskName "ECA_Monitor_Heartbeat" -ErrorAction SilentlyContinue
if ($oldTask) {
    schtasks /end /tn "ECA_Monitor_Heartbeat" 2>$null
    schtasks /change /tn "ECA_Monitor_Heartbeat" /disable 2>$null
    Write-Host "  -> Tarea 'ECA_Monitor_Heartbeat' deshabilitada." -ForegroundColor DarkYellow
} else {
    Write-Host "  -> No se encontro tarea PowerShell antigua. OK." -ForegroundColor DarkGray
}

# 5. Crear Tarea Programada para TODOS los usuarios
Write-Host "`n[3/3] Registrando Tarea Programada para todos los usuarios..." -ForegroundColor Yellow
$taskName = "ECA_Monitor_CSharp_Stream"

# Limpiar tarea vieja si existe
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    # Matar procesos existentes
    taskkill /im EcaMonitorAgent.exe /f 2>$null
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$taskAction   = New-ScheduledTaskAction -Execute "$TargetFolder\EcaMonitorAgent.exe" -WorkingDirectory "C:\ECA_Monitor"
$taskTrigger  = New-ScheduledTaskTrigger -AtLogOn
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0)
$taskPrincipal = New-ScheduledTaskPrincipal -GroupId "Usuarios" -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Principal $taskPrincipal -Description "ECA Monitor C# - Streaming en tiempo real" -Force | Out-Null

# Permitir multiples instancias (una por sesion RDP)
$task = Get-ScheduledTask -TaskName $taskName
$task.Settings.MultipleInstances = "Parallel"
Set-ScheduledTask -InputObject $task | Out-Null

# 6. Arrancar para sesiones actuales
Write-Host "`n-> Iniciando agente para sesiones activas..." -ForegroundColor Yellow
schtasks /run /tn $taskName | Out-Null
Start-Sleep -Seconds 2

# 7. Verificar
Write-Host "`n--- Procesos activos ---" -ForegroundColor Cyan
tasklist | findstr EcaMonitor

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host " Instalacion completada con exito!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host "El agente se ejecutara automaticamente para CADA usuario que inicie sesion."
Write-Host "Es invisible (sin ventana). Para detenerlo: taskkill /im EcaMonitorAgent.exe /f"
Pause
