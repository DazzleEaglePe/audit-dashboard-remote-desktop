# Plan de Implementación — Sistema de Auditoría RDP

## 1. Fases del Proyecto

### Fase 1: Preparación y Diagnóstico (Día 1)

| ID | Tarea | Descripción | Prioridad |
|----|-------|-------------|-----------|
| T-101 | Verificar estado de servidores | Confirmar que los 3 servidores tienen RDP Wrapper funcional, Shadow habilitado, y monitoreo BAT ejecutado | Alta |
| T-102 | Verificar conectividad Tailscale | Confirmar que los 3 servidores + PC supervisora están en la red Tailscale y se comunican | Alta |
| T-103 | Verificar puertos y servicios | Confirmar puertos 445, 135, 3389, y servicios RemoteRegistry, WMI activos | Alta |
| T-104 | Definir VPS y dominio | Confirmar disponibilidad del VPS existente o provisionar uno nuevo. Configurar subdominio en Namecheap | Alta |

### Fase 2: Desarrollo del Agente de Monitoreo (Días 2-3)

| ID | Tarea | Descripción | Prioridad |
|----|-------|-------------|-----------|
| T-201 | Desarrollar agente PowerShell | Script que recolecta sesiones (qwinsta), métricas (CPU, RAM), y procesos cada 30 segundos | Alta |
| T-202 | Implementar recolección de logs | Captura de eventos Windows (Event ID 4624/4634) para registro de conexiones/desconexiones | Alta |
| T-203 | Implementar envío a API | Módulo que envía datos recolectados al Dashboard vía HTTP/HTTPS (POST JSON) | Alta |
| T-204 | Crear Scheduled Task | Tarea programada de Windows para que el agente se ejecute automáticamente al iniciar el servidor | Media |
| T-205 | Desplegar agente en 3 servidores | Copiar e instalar el agente en los 3 servidores, verificar funcionamiento | Alta |

### Fase 2B: Módulo de Captura de Screenshots (Días 3-4)

| ID | Tarea | Descripción | Prioridad |
|----|-------|-------------|-----------|
| T-211 | Investigar método de captura por sesión | Evaluar opciones: Win32 API (BitBlt via .NET), WTSApi, Shadow invisible. Seleccionar el más eficiente y ligero. | Alta |
| T-212 | Desarrollar módulo de captura | Script PowerShell/.NET que capture screenshot de cada sesión RDP activa, redimensione a thumbnail (640x360) y comprima a JPEG Q70 | Alta |
| T-213 | Implementar envío de screenshots | Módulo que envía las imágenes capturadas al Dashboard API via POST multipart/form-data | Alta |
| T-214 | Optimizar rendimiento | Asegurar que la captura + compresión + envío no exceda 5% CPU y 100MB RAM adicionales por servidor | Media |
| T-215 | Implementar captura ampliada bajo demanda | Cuando el supervisor hace clic en un thumbnail, el agente captura a mayor resolución (1280x720) y la envía | Media |

### Fase 3: Desarrollo del Dashboard Web (Días 3-5)

| ID | Tarea | Descripción | Prioridad |
|----|-------|-------------|-----------|
| T-301 | Setup del proyecto (Next.js/React) | Inicializar proyecto con estructura base, Tailwind, dependencias | Alta |
| T-302 | Desarrollo de API Backend | Endpoints: recibir datos de agentes, consultar sesiones, obtener logs, alertas | Alta |
| T-303 | Implementar base de datos | Esquema para logs de sesiones, alertas, estado de servidores | Alta |
| T-304 | Dashboard principal | Vista con cards de cada servidor (estado, usuarios conectados, CPU/RAM) | Alta |
| T-305 | Vista de sesiones activas | Lista en tiempo real de todos los usuarios conectados con filtros | Alta |
| T-305B | Vista de mosaico de pantallas (screenshots) | Grid responsivo con thumbnails de cada sesión activa, actualizados cada 5-10 seg vía WebSocket. Click para ampliar a 1280x720. Organizado por servidor. | Alta |
| T-306 | Vista de logs/historial | Tabla con historial de conexiones/desconexiones, filtros por fecha/usuario/servidor | Media |
| T-307 | Sistema de alertas | Detección y visualización de alertas (sesiones inactivas, servidores caídos) | Media |
| T-308 | Autenticación | Login con usuario/contraseña para proteger el dashboard | Alta |
| T-309 | WebSockets | Actualización en tiempo real del dashboard sin refresh manual | Media |
| T-310 | Diseño responsivo | Optimización para celular y tablet | Media |

### Fase 4: Despliegue e Integración (Días 5-6)

| ID | Tarea | Descripción | Prioridad |
|----|-------|-------------|-----------|
| T-401 | Configurar VPS | Ubuntu, Node.js, PM2, Nginx como reverse proxy | Alta |
| T-402 | Configurar dominio y SSL | Apuntar subdominio a VPS, instalar Let's Encrypt | Alta |
| T-403 | Desplegar dashboard en VPS | Build de producción, configurar PM2, verificar funcionamiento | Alta |
| T-404 | Integración agentes ↔ dashboard | Verificar flujo completo: agentes envían → API recibe → dashboard muestra | Alta |
| T-405 | Configurar Tailscale en VPS | Opcional: agregar VPS a la red Tailscale para comunicación directa | Baja |

### Fase 5: Pruebas y Capacitación (Días 6-7)

| ID | Tarea | Descripción | Prioridad |
|----|-------|-------------|-----------|
| T-501 | Prueba end-to-end | Verificar flujo completo con usuarios reales conectados | Alta |
| T-502 | Prueba de Shadow Sessions | Verificar que el script PowerShell sigue funcional con el nuevo sistema | Alta |
| T-503 | Prueba de acceso remoto | Verificar dashboard desde celular y desde fuera de la oficina | Alta |
| T-504 | Prueba de alertas | Simular escenarios: servidor apagado, sesión inactiva, alta CPU | Media |
| T-505 | Capacitación | Sesión práctica de 2 horas con el personal designado | Alta |
| T-506 | Documentación final | Entregar manual de usuario y manual técnico actualizados | Alta |

---

## 2. Modelo de Datos

### 2.1 Tabla: servers

```sql
CREATE TABLE servers (
  id          TEXT PRIMARY KEY,    -- 'srv1', 'srv2', 'srv3'
  hostname    TEXT NOT NULL,       -- 'DESKTOP-E4F6THB'
  ip_lan      TEXT,                -- '192.168.18.4'
  ip_tailscale TEXT,               -- '100.108.248.45'
  cpu_model   TEXT,                -- 'Intel Core i5-10400'
  ram_gb      INTEGER,             -- 32
  status      TEXT DEFAULT 'unknown', -- 'online', 'offline', 'unknown'
  last_seen   DATETIME,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 Tabla: sessions

```sql
CREATE TABLE sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id   TEXT REFERENCES servers(id),
  username    TEXT NOT NULL,       -- 'CONT', 'SIST4'
  session_id  INTEGER,            -- Windows session ID
  state       TEXT,                -- 'Active', 'Idle', 'Disconnected'
  logon_time  DATETIME,
  source_ip   TEXT,
  idle_time   TEXT,                -- '00:05:23'
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3 Tabla: session_logs

```sql
CREATE TABLE session_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id   TEXT REFERENCES servers(id),
  username    TEXT NOT NULL,
  event_type  TEXT NOT NULL,       -- 'connect', 'disconnect', 'idle', 'active'
  session_id  INTEGER,
  source_ip   TEXT,
  timestamp   DATETIME NOT NULL,
  details     TEXT                 -- JSON con información adicional
);
```

### 2.4 Tabla: server_metrics

```sql
CREATE TABLE server_metrics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id   TEXT REFERENCES servers(id),
  cpu_percent REAL,
  ram_used_mb INTEGER,
  ram_total_mb INTEGER,
  disk_percent REAL,
  active_sessions INTEGER,
  timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.5 Tabla: alerts

```sql
CREATE TABLE alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id   TEXT REFERENCES servers(id),
  alert_type  TEXT NOT NULL,       -- 'server_down', 'session_idle', 'high_cpu', 'login_failed'
  severity    TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'
  message     TEXT,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. API Endpoints

### 3.1 Agente → Dashboard (Recepción de datos)

```
POST /api/agent/heartbeat
Headers: { "x-api-key": "..." }
Body: {
  "server_id": "srv1",
  "hostname": "DESKTOP-E4F6THB",
  "metrics": {
    "cpu_percent": 45.2,
    "ram_used_mb": 18432,
    "ram_total_mb": 32768,
    "disk_percent": 62.1
  },
  "sessions": [
    {
      "username": "CONT",
      "session_id": 2,
      "state": "Active",
      "idle_time": "00:00:00",
      "logon_time": "2026-03-04T08:30:00Z",
      "source_ip": "192.168.18.50"
    }
  ]
}
```

```
POST /api/agent/event
Headers: { "x-api-key": "..." }
Body: {
  "server_id": "srv1",
  "event_type": "connect",
  "username": "CONT",
  "session_id": 2,
  "source_ip": "192.168.18.50",
  "timestamp": "2026-03-04T08:30:00Z"
}
```

```
POST /api/agent/screenshot
Headers: { "x-api-key": "..." }
Content-Type: multipart/form-data
Body: {
  "server_id": "srv1",
  "username": "CONT",
  "session_id": 2,
  "timestamp": "2026-03-04T09:15:05Z",
  "resolution": "thumbnail",        // "thumbnail" (640x360) o "full" (1280x720)
  "image": <binary JPEG>            // 30-50 KB thumbnail, 80-150 KB full
}
Response: { "status": "ok", "stored_at": "/screenshots/srv1/CONT_latest.jpg" }
```

### 3.2 Dashboard (Consulta)

```
GET    /api/servers                    → Lista servidores con estado actual
GET    /api/servers/:id/sessions       → Sesiones activas de un servidor
GET    /api/sessions                   → Todas las sesiones activas
GET    /api/sessions/:id/screenshot    → Último screenshot de una sesión
GET    /api/screenshots                → Todos los screenshots actuales (mosaico)
GET    /api/logs?from=...&to=...&user=...  → Logs de auditoría con filtros
GET    /api/alerts?unread=true         → Alertas pendientes
PUT    /api/alerts/:id/read            → Marcar alerta como leída
POST   /api/auth/login                 → Autenticación
```

### 3.3 WebSocket

```
WS /ws/dashboard

Eventos emitidos por el servidor:
  - "server:update"    → Actualización de estado de servidor
  - "session:change"   → Usuario se conecta/desconecta
  - "screenshot:update" → Nuevo screenshot disponible { server_id, username, image_url, timestamp }
  - "alert:new"        → Nueva alerta generada
  - "metrics:update"   → Actualización de métricas (CPU, RAM)
```

---

## 4. Agente PowerShell — Estructura

```powershell
# Agente de Monitoreo - Estructura principal
# Se ejecuta como Scheduled Task en cada servidor

$CONFIG = @{
    ServerId    = "srv1"                              # Identificador único
    Hostname    = $env:COMPUTERNAME                    # Hostname automático
    ApiUrl      = "https://auditoria.dominio.com/api" # URL del dashboard
    ApiKey      = "clave-secreta-aqui"                 # API Key de autenticación
    Interval    = 30                                   # Segundos entre cada reporte
}

function Get-SessionData {
    # Ejecuta quser/qwinsta y parsea resultados
    # Retorna array de objetos con: username, session_id, state, idle_time, logon_time
}

function Get-ServerMetrics {
    # Recolecta CPU %, RAM usada/total, disco %
    # Retorna objeto con métricas
}

function Get-RecentEvents {
    # Consulta Windows Event Log (Security 4624/4634)
    # Filtra eventos desde último check
    # Retorna array de eventos de logon/logoff
}

function Capture-SessionScreenshot {
    param($sessionId, $username)
    # Captura screenshot de una sesión RDP específica
    # Métodos posibles:
    #   A) Win32 API via .NET: [System.Drawing.Graphics]::CopyFromScreen()
    #      ejecutado en el contexto de la sesión del usuario
    #   B) WTSApi: WTSQuerySessionInformation para obtener handle de sesión
    #      + BitBlt para capturar el desktop de esa sesión
    #   C) Shadow invisible: mstsc /shadow:$sessionId en modo headless
    #      + captura de la ventana shadow
    #
    # Post-procesamiento:
    #   1. Redimensionar a 640x360 (thumbnail) usando System.Drawing
    #   2. Comprimir a JPEG calidad 70%
    #   3. Retornar bytes de la imagen
    #
    # Retorna: [byte[]] imagen JPEG comprimida
}

function Send-Screenshot {
    param($serverId, $username, $sessionId, $imageBytes)
    # POST multipart/form-data a /api/agent/screenshot
    # Incluye: server_id, username, session_id, timestamp, image binary
}

function Send-Heartbeat {
    param($sessions, $metrics)
    # POST a /api/agent/heartbeat con datos recolectados
}

function Send-Event {
    param($event)
    # POST a /api/agent/event con evento de conexión/desconexión
}

# Loop principal
while ($true) {
    $sessions = Get-SessionData
    $metrics = Get-ServerMetrics
    $events = Get-RecentEvents

    Send-Heartbeat -sessions $sessions -metrics $metrics

    foreach ($event in $events) {
        Send-Event -event $event
    }

    # Captura y envío de screenshots (cada iteración)
    foreach ($session in $sessions | Where-Object { $_.State -eq 'Active' }) {
        $screenshot = Capture-SessionScreenshot -sessionId $session.SessionId -username $session.Username
        if ($screenshot) {
            Send-Screenshot -serverId $CONFIG.ServerId -username $session.Username `
                           -sessionId $session.SessionId -imageBytes $screenshot
        }
    }

    Start-Sleep -Seconds $CONFIG.Interval  # 5-10 segundos para screenshots
}
```

---

## 5. Scripts Existentes (Ya Desarrollados)

### 5.1 RDP_Monitor_ECA.ps1
Script PowerShell para monitoreo local con Shadow Sessions. Incluye:
- Configuración de IPs LAN y Tailscale para los 3 servidores
- Menú interactivo con 6 opciones
- Escaneo de sesiones vía qwinsta
- Apertura de Shadow Sessions en mosaico
- Cambio de modo de red (LAN/Tailscale)

### 5.2 Habilitar_Monitoreo_RDP.bat
Script BAT para configurar servidores. Ejecuta:
- Apertura de puertos de firewall (445, 135, RPC dinámico)
- Habilitación de Registro Remoto (auto start)
- Habilitación de WMI
- Configuración de WinRM
- Shadow RDP = 2 (sin consentimiento)
- AllowRemoteRPC = 1
- Reinicio de TermService

---

## 6. Consideraciones Especiales

### 6.1 RDP Wrapper y Windows Updates
- Windows Updates pueden romper el RDP Wrapper al actualizar `termsrv.dll`
- Se debe incluir en el agente una verificación periódica del estado de RDP Wrapper
- Si detecta `[not supported]`, generar alerta crítica
- Procedimiento de re-parcheo: copiar bloque del INI para la nueva build (proceso manual documentado)

### 6.2 SQL Server 2022
- CONCAR SQL usa SQL Server 2022 local en el Servidor 1
- La base de datos está en `DESKTOP-E4F6THB\SQLEXPRESS` (o instancia local)
- Los otros servidores se conectan al SQL Server del Servidor 1
- El sistema de auditoría NO interactúa con SQL Server ni con CONCAR

### 6.3 Usuarios y Permisos
- Los usuarios RDP (CONT, SIST1-10) son usuarios locales de Windows en cada servidor
- Permisos de carpeta `C:\RSCONCAR`: Control total para grupo "Usuarios"
- El agente de monitoreo debe ejecutarse con privilegios de administrador (para qwinsta y Event Log)
