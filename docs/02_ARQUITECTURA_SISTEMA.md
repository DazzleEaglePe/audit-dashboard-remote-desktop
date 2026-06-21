# Arquitectura del Sistema — Auditoría y Monitoreo RDP

## 1. Diagrama de Arquitectura General

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        INTERNET / TAILSCALE MESH                            │
└──────────┬────────────────────────┬────────────────────────┬────────────────┘
           │                        │                        │
           ▼                        ▼                        ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   SERVIDOR 1    │   │   SERVIDOR 2    │   │   SERVIDOR 3    │
│ DESKTOP-E4F6THB │   │ DESKTOP-TR7OGR1 │   │ DESKTOP-LKSNKOL │
│ i5-10400 / 32GB │   │ i5-6500T / 16GB │   │ i5-4590S / 16GB │
│                 │   │                 │   │                 │
│ ┌─────────────┐ │   │ ┌─────────────┐ │   │ ┌─────────────┐ │
│ │ RDP Wrapper │ │   │ │ RDP Wrapper │ │   │ │ RDP Wrapper │ │
│ │ (multi-RDP) │ │   │ │ (multi-RDP) │ │   │ │ (multi-RDP) │ │
│ └─────────────┘ │   │ └─────────────┘ │   │ └─────────────┘ │
│ ┌─────────────┐ │   │ ┌─────────────┐ │   │ ┌─────────────┐ │
│ │ CONCAR SQL  │ │   │ │ CONCAR SQL  │ │   │ │ CONCAR SQL  │ │
│ └─────────────┘ │   │ └─────────────┘ │   │ └─────────────┘ │
│ ┌─────────────┐ │   │ ┌─────────────┐ │   │ ┌─────────────┐ │
│ │  Tailscale  │ │   │ │  Tailscale  │ │   │ │  Tailscale  │ │
│ └─────────────┘ │   │ └─────────────┘ │   │ └─────────────┘ │
│ ┌─────────────┐ │   │ ┌─────────────┐ │   │ ┌─────────────┐ │
│ │   Agente    │ │   │ │   Agente    │ │   │ │   Agente    │ │
│ │  Monitoreo  │ │   │ │  Monitoreo  │ │   │ │  Monitoreo  │ │
│ └─────────────┘ │   │ └─────────────┘ │   │ └─────────────┘ │
│                 │   │                 │   │                 │
│ LAN: .18.4     │   │ LAN: .18.31    │   │ LAN: .18.136   │
│ TS: 100.108... │   │ TS: 100.112... │   │ TS: 100.109... │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └──────────┬──────────┴──────────┬──────────┘
                    │                     │
                    ▼                     ▼
          ┌──────────────────┐  ┌──────────────────────────┐
          │  PC SUPERVISORA  │  │     VPS / CLOUD SERVER   │
          │  (Red Local)     │  │   (Dashboard Web)        │
          │                  │  │                          │
          │ ┌──────────────┐ │  │ ┌──────────────────────┐ │
          │ │  PowerShell  │ │  │ │   Dashboard Web App  │ │
          │ │  Monitor     │ │  │ │   (React / Next.js)  │ │
          │ │  + Shadow    │ │  │ │                      │ │
          │ │  Sessions    │ │  │ │ - Estado servidores   │ │
          │ └──────────────┘ │  │ │ - Sesiones activas    │ │
          └──────────────────┘  │ │ - Logs de auditoría   │ │
                                │ │ - Alertas             │ │
                                │ └──────────────────────┘ │
                                │                          │
                                │  auditoria.dominio.com   │
                                └──────────────────────────┘
```

---

## 2. Componentes del Sistema

### 2.1 Componente Local — Script PowerShell de Monitoreo

**Ubicación:** PC Supervisora (red local o vía Tailscale)

**Funcionalidades:**
- Escaneo de sesiones RDP activas en los 3 servidores usando `qwinsta`
- Apertura de Shadow Sessions en modo solo lectura (`mstsc /shadow:ID /v:SERVIDOR /noConsentPrompt`)
- Organización de ventanas en mosaico automático
- Cambio de modo de red (LAN / Tailscale)
- Test de conectividad a servidores

**Archivo existente:** `RDP_Monitor_ECA.ps1`

**Flujo de ejecución:**
```
Inicio → Selección de modo red (LAN/Tailscale)
       → Menú principal
           ├── [1] Ver sesiones activas → qwinsta /server:IP (x3 servidores)
           ├── [2] Shadow ALL → Abre mstsc /shadow para cada sesión detectada
           ├── [3] Shadow por servidor → Filtra sesiones de 1 servidor
           ├── [4] Shadow sesión específica → Selección manual
           ├── [5] Cambiar red → LAN ↔ Tailscale
           ├── [6] Test conectividad → ping a cada IP
           └── [Q] Salir
```

### 2.2 Componente Servidor — Agente de Monitoreo

**Ubicación:** Cada uno de los 3 servidores Windows

**Funcionalidades:**
- Recolección de métricas: sesiones activas, CPU, RAM, procesos por usuario
- Registro de eventos de conexión/desconexión
- Envío de datos al Dashboard Web (API REST o WebSocket)

**Configuración previa requerida (ya aplicada):**
```
Habilitar_Monitoreo_RDP.bat ejecutado en los 3 servidores:
  ├── Firewall: puertos 445, 135, 49152-65535 abiertos
  ├── Servicio Registro Remoto: habilitado (auto start)
  ├── WMI: habilitado
  ├── WinRM: habilitado
  ├── Shadow RDP: Shadow=2 (sin consentimiento)
  └── AllowRemoteRPC: habilitado
```

### 2.3 Componente Cloud — Dashboard Web

**Ubicación:** VPS (a definir) + Dominio (Namecheap existente)

**Stack sugerido:**
- **Frontend:** React / Next.js con Tailwind CSS
- **Backend API:** Node.js (Express) o Next.js API Routes
- **Base de datos:** SQLite o PostgreSQL (para logs)
- **Hosting:** VPS Linux (Ubuntu) o Railway/Vercel
- **SSL:** Let's Encrypt (certbot)
- **Dominio:** Subdominio del dominio Namecheap existente

**Funcionalidades:**
- Dashboard en tiempo real con WebSockets
- Vista de servidores: estado online/offline, métricas CPU/RAM
- Lista de sesiones activas con filtros por servidor
- Historial de conexiones (logs)
- Sistema de alertas (sesiones inactivas, servidores caídos)
- Autenticación básica (login)
- Diseño responsivo (acceso desde celular)

---

## 3. Flujos del Sistema

### 3.1 Flujo de Monitoreo en Tiempo Real

```
                     Cada 30 segundos
                            │
Agente (Servidor 1) ────────┤
Agente (Servidor 2) ────────┼──── API REST/WS ──── Dashboard Web
Agente (Servidor 3) ────────┤                         │
                            │                         ▼
                     Datos enviados:           Renderiza en UI:
                     - Sesiones activas        - Cards por servidor
                     - CPU/RAM %               - Lista de usuarios
                     - Procesos CONCAR         - Gráficos de uso
                     - Uptime                  - Timeline de eventos
```

### 3.2 Flujo de Shadow Sessions (Local)

```
Supervisor abre RDP_Monitor_ECA.ps1
       │
       ├── Selecciona modo red (LAN o Tailscale)
       │
       ├── Opción "Ver sesiones" 
       │       │
       │       └── qwinsta /server:192.168.18.4
       │           qwinsta /server:192.168.18.31
       │           qwinsta /server:192.168.18.136
       │                 │
       │                 └── Muestra tabla: Usuario | ID | Estado | Servidor
       │
       └── Opción "Shadow ALL"
               │
               └── Para cada sesión activa:
                       mstsc /shadow:{ID} /v:{IP} /noConsentPrompt
                             │
                             └── Ventana RDP en modo solo lectura
                                 (organizada en mosaico automático)
```

### 3.3 Flujo de Registro de Logs

```
Usuario se conecta vía RDP
       │
       ▼
Windows Event Log registra evento 4624 (Logon) / 4634 (Logoff)
       │
       ▼
Agente de Monitoreo detecta cambio (polling o event subscription)
       │
       ▼
Envía evento a Dashboard API:
{
  "event": "connect",
  "user": "CONT",
  "server": "DESKTOP-E4F6THB",
  "timestamp": "2026-03-04T09:15:00Z",
  "source_ip": "192.168.18.50",
  "session_id": 3
}
       │
       ▼
Dashboard almacena en DB y actualiza UI en tiempo real
```

### 3.4 Flujo de Alertas

```
Agente detecta condición anómala:
  ├── Sesión inactiva > 30 min
  ├── Servidor no responde a ping
  ├── CPU > 90% por más de 5 min
  └── Intento de conexión fallido
       │
       ▼
Envía alerta a Dashboard API
       │
       ▼
Dashboard:
  ├── Muestra notificación visual (badge, toast)
  ├── Registra en log de alertas
  └── (Opcional) Envía notificación WhatsApp/Email
```

### 3.5 Flujo de Screenshots en Tiempo Real

```
Cada 5-10 segundos por sesión activa:

Agente (en cada servidor)
       │
       ├── Detecta sesiones activas (qwinsta)
       │
       ├── Para cada sesión activa:
       │       │
       │       ├── Captura screenshot de la sesión
       │       │   (vía WMI / Win32 API / PowerShell + .NET)
       │       │
       │       ├── Redimensiona a thumbnail (640x360 px)
       │       │
       │       ├── Comprime a JPEG (calidad 70%)
       │       │   Peso estimado: 30-50 KB por imagen
       │       │
       │       └── Envía al Dashboard API
       │           POST /api/agent/screenshot
       │           Content-Type: multipart/form-data
       │           {
       │             server_id, username, session_id,
       │             timestamp, image (JPEG binary)
       │           }
       │
       ▼
Dashboard API:
       │
       ├── Almacena en buffer rotativo (último screenshot por sesión)
       │   /storage/screenshots/{server_id}/{username}_latest.jpg
       │
       ├── Emite evento WebSocket: "screenshot:update"
       │   { server_id, username, timestamp, image_url }
       │
       └── Frontend actualiza thumbnail en el mosaico
           ┌─────────────────────────────────────────────┐
           │          MOSAICO DE PANTALLAS               │
           │                                             │
           │  SERVIDOR 1      SERVIDOR 2     SERVIDOR 3  │
           │  ┌────┐┌────┐   ┌────┐┌────┐  ┌────┐┌────┐│
           │  │CONT││CNT1│   │SIS4││SIS5│  │SIS8││SIS9││
           │  └────┘└────┘   └────┘└────┘  └────┘└────┘│
           │  ┌────┐┌────┐   ┌────┐┌────┐  ┌────┐      │
           │  │SIST││SIS1│   │SIS6││SIS7│  │SIS2│      │
           │  └────┘└────┘   └────┘└────┘  └────┘      │
           │  ┌────┐                                    │
           │  │SIS3│  Click en thumbnail → Vista amplia │
           │  └────┘  (1280x720 px, actualiza cada 5s)  │
           └─────────────────────────────────────────────┘

Captura de screenshot por sesión (PowerShell):
  Opción A: Usar WTSQuerySessionInformation + BitBlt (Win32 API vía .NET)
  Opción B: Ejecutar comando en contexto de sesión vía WTSApi
  Opción C: Shadow session invisible + captura de ventana
```

**Consideraciones de rendimiento (screenshots):**

| Parámetro | Valor |
|-----------|-------|
| Intervalo de captura | 5-10 segundos por sesión |
| Resolución thumbnail | 640 x 360 px |
| Resolución ampliada | 1280 x 720 px |
| Formato | JPEG calidad 70% |
| Peso estimado por imagen | 30-50 KB (thumbnail), 80-150 KB (ampliada) |
| Sesiones simultáneas | 12-13 |
| Tráfico estimado | ~3-5 MB/min (upload combinado 3 servidores) |
| CPU adicional por servidor | ~2-5% (captura + compresión) |
| RAM adicional por servidor | ~50-100 MB |
| Almacenamiento en VPS | Buffer rotativo, ~100 MB máx (solo últimos screenshots) |

---

## 4. Protocolos y Puertos

| Protocolo | Puerto | Uso | Dirección |
|-----------|--------|-----|-----------|
| RDP | 3389/TCP | Conexión escritorio remoto y Shadow Sessions | Bidireccional |
| SMB | 445/TCP | Consulta remota de sesiones (qwinsta) | Supervisora → Servidores |
| RPC | 135/TCP | Administración remota | Supervisora → Servidores |
| RPC Dinámico | 49152-65535/TCP | WMI y administración remota | Supervisora → Servidores |
| Tailscale | WireGuard (UDP) | VPN mesh para acceso remoto | Todos los nodos |
| HTTPS | 443/TCP | Dashboard web | VPS → Navegador |
| HTTP/WS | 80/443 | API del agente → Dashboard | Servidores → VPS |

---

## 5. Seguridad

### 5.1 Acceso al Dashboard
- Autenticación por usuario/contraseña
- HTTPS obligatorio (Let's Encrypt)
- Rate limiting en endpoints de API

### 5.2 Comunicación Agente-Dashboard
- API Key para autenticación de agentes
- Comunicación sobre HTTPS
- Whitelist de IPs de Tailscale (opcional)

### 5.3 Shadow Sessions
- Modo solo lectura (Shadow=2, sin control)
- Sin consentimiento del usuario (modo auditoría)
- Solo accesible desde PC supervisora autenticada

---

## 6. Tecnologías Recomendadas

| Capa | Tecnología | Justificación |
|------|------------|---------------|
| Agente (servidores) | PowerShell + Scheduled Task | Nativo de Windows, sin dependencias adicionales |
| Dashboard Frontend | React / Next.js + Tailwind | Moderno, responsivo, experiencia de Bruno |
| Dashboard Backend | Node.js (Express) o Next.js API | Stack unificado con frontend |
| Base de datos | SQLite o PostgreSQL | SQLite para simplicidad, PostgreSQL si escala |
| Real-time | WebSockets (Socket.io) | Actualización instantánea del dashboard |
| Hosting | VPS Linux (Ubuntu 22.04) | Control total, bajo costo |
| SSL | Let's Encrypt + Certbot | Gratuito, renovación automática |
| CI/CD | GitHub Actions (opcional) | Despliegue automático |
