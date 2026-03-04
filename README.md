# ECA Monitor – Sistema de Auditoría de Escritorio Remoto 🔒🖥️

Un panel de control en tiempo real de alto rendimiento diseñado para la auditoría y monitoreo de múltiples Servidores Windows y sus sesiones de Escritorio Remoto (RDP) activas. Construido con tecnologías web modernas para proveer visibilidad instantánea sobre la actividad de los usuarios, el estado de los servidores y eventos de seguridad.

![Vista Previa del Dashboard](https://github.com/DazzleEaglePe/audit-dashboard-remote-desktop/blob/main/public/preview.png?raw=true) *(Nota: Agrega aquí una captura de pantalla del dashboard)*

## 🚀 Propósito y Problema Resuelto
Administrar múltiples servidores Windows con múltiples usuarios RDP conectados al mismo tiempo suele generar "puntos ciegos" respecto a qué están haciendo los usuarios, cuándo inician sesión y cuál es la carga de trabajo real en los servidores.

ECA Monitor resuelve esto desplegando un agente ultraligero que se ejecuta en segundo plano en cada servidor Windows y alimenta de manera continua datos de sistema, capturas de pantalla y métricas de seguridad a un moderno panel web en Next.js. Actúa como una "cámara de seguridad" de élite y un monitor vital de recursos para toda tu infraestructura RDP.

## ✨ Características Principales

*   **Mosaico en Tiempo Real (Live Screenshots):** Visualiza miniaturas en vivo de cada escritorio activo a través de todos los servidores de manera simultánea.
*   **Transmisión WebSocket Latencia Cero:** Las imágenes son capturadas, codificadas a Base64 y transmitidas instantáneamente de forma directa al DOM de React vía Socket.io, eliminando cualquier retraso clásico de peticiones HTTP.
*   **Gestión de Sesiones Activas:** Ve al instante quién está conectado, su ID de sesión y su estado de conexión (`Activo` vs `Desconectado`).
*   **Telemetría de Salud del Servidor:** Monitorea el uso de CPU, RAM y almacenamiento de cada servidor conectado en tiempo real para prevenir sobrecargas.
*   **Logs de Auditoría Automatizados:** Captura los registros de eventos de Windows (Event IDs 4624/4634) para mantener un historial inmutable de cada inicio y cierre de sesión exitoso.
*   **Sistema Inteligente de Alertas:** Detecta servidores desconectados de la red y mantiene un registro de notificaciones persistentes para el administrador en el panel de control.

## 🛠️ Arquitectura y Stack Tecnológico

Este proyecto utiliza una arquitectura desacoplada Cliente-Servidor diseñada para máxima estabilidad en los servidores de origen y máximo rendimiento en el lado del visualizador (frontend).

### 1. El Dashboard (Backend & Frontend)
Alojado en un servidor VPS Linux, organiza las respuestas de los agentes y sirve la Interfaz de Usuario.
*   **Framework:** Next.js 14+ (App Router) & React 19
*   **Protocolo de Tiempo Real:** Socket.io (Dual HTTP Polling + WebSocket Base64 Streaming)
*   **Base de Datos:** SQLite local de alta velocidad (`better-sqlite3`) para ingesta y lectura instantánea.
*   **Estilos y UI:** Tailwind CSS, `shadcn/ui` y Lucide Icons, diseñados con estética visual premium (Glassmorphism / Modo Oscuro).
*   **Autenticación:** Sistema de login seguro con JWT y cifrado de contraseñas.

### 2. El Agente (Endpoint)
Se ejecuta de forma invisible y silenciosa en los servidores Windows de destino sin interrumpir a los usuarios.
*   **Núcleo:** PowerShell Nativo usando integración de bibliotecas .NET/C#.
*   **Sub-procesos:** Utiliza la herramienta Sysinternals `PsExec` de Microsoft para acceder de manera segura a sesiones bloqueadas de usuarios ajenos y capturar arreglos gráficos.
*   **Resiliencia:** Se implementa como una Tarea Programada de Windows inquebrantable (`AtLogOn`), que maneja reconexiones automáticas, guardado en búfer local y reintentos HTTP POST silenciosos en caso de pérdida de red.

## 📈 Beneficios para la Organización
1.  **Aumento de Transparencia:** Los colaboradores saben que el entorno RDP corporativo es auditado, mejorando orgánicamente la productividad y el cumplimiento de normas.
2.  **Troubleshooting Instantáneo:** El equipo de TI puede ver inmediatamente qué está ocurriendo en la pantalla de un usuario sin necesidad de iniciar una molesta intervención de soporte remoto que interrumpa su flujo.
3.  **Gestión Proactiva de TI:** Identifica de un vistazo qué servidor está sufriendo sobrecarga de memoria antes de que provoque una caída del sistema que afecte a los demás usuarios contables.
4.  **Capacidad Forense de Seguridad:** Si acontece algún incidente, la combinación de registros y capturas de pantalla conforman una línea de tiempo infalible comprobando accesos RDP.

## ⚙️ Instalación y Despliegue

### Servidor del Dashboard (VPS)
```bash
git clone https://github.com/DazzleEaglePe/audit-dashboard-remote-desktop.git
cd audit-dashboard-remote-desktop/dashboard
npm install
# Configura .env.local con JWT_SECRET y la variable secreta API_KEY
npm run build
pm2 start server.js --name "eca-dashboard"
```

### Despliegue de Agentes en Windows
Se provee un script maestro unificado escrito en PowerShell que puede ser pegado por Administradores directamente en la consola del Servidor. Éste script automatiza la descarga en la ruta `C:\ECA_Monitor\`, programa la "Auto-Recuperación de Procesos" contra fallas en el inicio de Windows y añade automáticamente las necesarias exclusiones de intrusión nativa sobre Windows Defender.

---

*Desarrollado de manera autónoma como herramienta avanzada de monitoreo de infraestructura RDP.*
