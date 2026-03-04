# Agente ECA Monitor

Scripts para el monitoreo de servidores y sesiones RDP, incluyendo capturas de pantalla de los escritorios en tiempo real.

## Requisitos Previos

1.  **PsExec (Sysinternals):** El agente requiere de la herramienta `PsExec.exe` de Microsoft Sysinternals para inyectar un script en las sesiones de usuario para la captura de pantalla de forma silenciosa e invisible. Descárgalo de Microsoft y pon el archivo `psexec.exe` en esta carpeta (`C:\ECA_Monitor`).
2.  **Windows 10 v1803+ o superior:** El script usa la herramienta nativa `curl.exe` preinstalada en Windows 10 para evitar un fallo técnico común al mandar Multipart Form-Data (imágenes) vía Powershell nativo.

## Instalación

1.  Copia la carpeta entera `agent/` a los 3 servidores ECA (puedes guardarla en `C:\ECA_Monitor`).
2.  Asegúrate de copiar también el binario Sysinternals `psexec.exe` dentro de esta carpeta de agente.
3.  Edita el archivo `config.json` con:
    *   `server_id`: srv1, srv2 o srv3
    *   `api_url`: `https://dashboard.ecabot.site/api`
    *   `api_key`: `eca-dev-api-key-2026` (Asegúrate que coincida con la que pones en tu backend de VPS).
4.  Desde PowerShell (como Administrador), sitúate en la carpeta y haz correr:
    ```powershell
    .\Install-Agent.ps1
    ```
5.  Una vez finalizado, puedes probar manualmente una ejecución o esperar a que la tarea programada ("ECA_Monitor_Heartbeat") inicie desde el Task Scheduler de Windows.
