# Requerimientos Técnicos — Sistema de Auditoría y Monitoreo de Escritorios Remotos

## 1. Contexto del Proyecto

### 1.1 Cliente
**ECA Estudio Contable Alvarez** — Estudio contable que opera con el sistema CONCAR SQL v.14.25, utilizado por aproximadamente 12-13 usuarios simultáneos distribuidos en 3 servidores Windows 10 Pro.

### 1.2 Situación Actual
El cliente cuenta con una infraestructura de escritorios remotos ya implementada y operativa. Los servidores utilizan **RDP Wrapper** (fork de sebaxakerhtc) para permitir múltiples sesiones simultáneas de Escritorio Remoto sobre Windows 10 Pro. La conectividad remota se gestiona mediante **Tailscale** (mesh VPN peer-to-peer gratuita).

### 1.3 Necesidad
Implementar un sistema de **auditoría y monitoreo en tiempo real** que permita al administrador/supervisor visualizar las sesiones activas, ver las pantallas de los usuarios (modo solo lectura), consultar logs de conexión, y acceder a esta información tanto desde la red local (LAN) como de forma remota (Tailscale / Dashboard Web).

---

## 2. Infraestructura Existente

### 2.1 Servidores

| Servidor | Hostname | Procesador | RAM | IP LAN | IP Tailscale | Usuarios | SO |
|----------|----------|------------|-----|--------|--------------|----------|----|
| Servidor 1 (Principal) | DESKTOP-E4F6THB | Intel Core i5-10400 (6 núcleos, 12 hilos) | 32 GB | 192.168.18.4 | 100.108.248.45 | ~5 usuarios | Windows 10 Pro 22H2 |
| Servidor 2 | DESKTOP-TR7OGR1 | Intel Core i5-6500T (4 núcleos) | 16 GB | 192.168.18.31 | 100.112.15.36 | ~4 usuarios | Windows 10 Pro |
| Servidor 3 | DESKTOP-LKSNKOL | Intel Core i5-4590S (4 núcleos) | 16 GB | 192.168.18.136 | 100.109.28.98 | ~3-4 usuarios | Windows 10 Pro |

**Total:** 3 servidores, 12-13 usuarios simultáneos.

### 2.2 Usuarios Configurados en el Sistema

| Usuario | Nombre Completo | Servidor Asignado |
|---------|-----------------|-------------------|
| CONT | Winner Huamantalla | Servidor 1 |
| CONT1 | Melany Roldan Berrocal | Servidor 1 |
| SIST | Gianmarco Hugo Villalva Castillo | Servidor 1 |
| SIST1 | Ruly Segura Martinez | Servidor 1 |
| SIST3 | Miluska Alvarez Sandoval | Servidor 1 |
| SIST4 | Alexander Alania | Servidor 2 |
| SIST5 | Evelyn Acero Castillo | Servidor 2 |
| SIST6 | Adrian Antonio Zavaleta Ticona | Servidor 2 |
| SIST7 | Mallury Carrasco Segundo | Servidor 2 |
| SIST8 | Emerson Chaupin Huari | Servidor 3 |
| SIST9 | Edith Cerrón Alvarez | Servidor 3 |
| SIST2 | María Melendez Contreras | Servidor 3 |

### 2.3 Software y Herramientas en los Servidores

| Componente | Detalle |
|------------|---------|
| Sistema Operativo | Windows 10 Pro (Build 10.0.19041.6926) |
| Software Contable | CONCAR SQL v.14.25 (ruta: `C:\RSCONCAR\RSCONCAR.exe`) |
| Base de Datos | SQL Server 2022 |
| Multi-sesión RDP | RDP Wrapper (fork sebaxakerhtc v1.7.4.0+) |
| VPN Remota | Tailscale (mesh VPN peer-to-peer) |
| Puerto RDP | 3389 (estándar) |

### 2.4 Configuraciones RDP Existentes

Cada servidor tiene configurado:
- **RDP Wrapper** instalado con `rdpwrap.ini` parcheado para build 6926 (bloque `[10.0.19041.6926]` agregado manualmente copiando offsets del bloque `[10.0.19041.6456]`).
- **"Single session per user"** deshabilitado.
- **Política de grupo**: "Restringir usuarios a una única sesión" deshabilitada.
- **Shadow Sessions**: Habilitado con `Shadow = 2` (observar sin consentimiento del usuario).
- **Firewall**: Puertos 3389, 445, 135 y rango RPC dinámico (49152-65535) abiertos.
- **Servicios habilitados**: Registro Remoto, WMI, WinRM.
- **Permisos**: Carpeta `C:\RSCONCAR` con "Control total" para grupo "Usuarios".
- **Acceso directo público**: `C:\Users\Public\Desktop\CONCAR SQL`.

### 2.5 Red

- **Red LAN**: 192.168.18.0/24, puerta de enlace 192.168.18.1
- **Tailscale**: Red mesh 100.x.x.x (cada servidor y la PC de supervisión tienen Tailscale instalado)
- Los 3 servidores comparten la misma red local física

---

## 3. Requerimientos Funcionales

### RF-01: Monitoreo de Sesiones en Tiempo Real
El sistema debe mostrar en tiempo real las sesiones RDP activas en los 3 servidores, incluyendo: nombre de usuario, servidor asignado, estado de la sesión (activa/inactiva/desconectada), tiempo de conexión, e ID de sesión.

### RF-02: Visualización de Pantallas (Shadow)
El sistema debe permitir la visualización en tiempo real de la pantalla de cualquier usuario conectado mediante Shadow Sessions RDP, en modo solo lectura (sin control). Debe soportar visualización en mosaico (múltiples sesiones simultáneas).

### RF-03: Logs de Auditoría
El sistema debe registrar y almacenar logs de conexión/desconexión de cada usuario, incluyendo timestamps, duración de sesión, servidor utilizado, y dirección IP de origen.

### RF-04: Dashboard Web Remoto
El sistema debe contar con un dashboard web accesible desde cualquier navegador (PC, tablet, celular) que muestre métricas de monitoreo, estado de servidores, sesiones activas y logs históricos. Accesible vía dominio personalizado (ej: `auditoria.dominio.com`).

### RF-05: Alertas
El sistema debe generar alertas ante: sesiones inactivas por tiempo prolongado, intentos de conexión fallidos, servidores fuera de línea, y uso excesivo de recursos.

### RF-06: Acceso Dual (LAN + Remoto)
El monitoreo completo (incluyendo Shadow Sessions) debe funcionar desde la red LAN. El dashboard de métricas y logs debe ser accesible remotamente vía Tailscale o web pública.

### RF-07: Visualización de Pantallas en Tiempo Real (Screenshots)
El sistema debe capturar screenshots periódicos (cada 5-10 segundos) de cada sesión RDP activa en los 3 servidores y mostrarlos en el dashboard web como thumbnails en tiempo real. El supervisor debe poder:
- Ver un mosaico de todas las pantallas activas (12-13 sesiones) desde el dashboard web.
- Hacer clic en un thumbnail para ampliarlo a mayor resolución.
- Visualizar los screenshots desde cualquier dispositivo (PC, tablet, celular) y desde cualquier ubicación.
- Los screenshots deben ser livianos (comprimidos en JPEG, resolución thumbnail ~640x360px para la vista mosaico, con opción de ~1280x720px al ampliar).

---

## 4. Requerimientos No Funcionales

### RNF-01: Disponibilidad
El dashboard web debe estar disponible 24/7 mientras los servidores estén encendidos.

### RNF-02: Seguridad
- Acceso al dashboard protegido por autenticación (usuario/contraseña mínimo).
- Conexión HTTPS con certificado SSL.
- Shadow Sessions solo en modo lectura.

### RNF-03: Rendimiento
- El monitoreo no debe consumir más del 5% de CPU ni más de 512MB de RAM adicional en cada servidor.
- El dashboard debe cargar en menos de 3 segundos.

### RNF-04: Compatibilidad
- Dashboard responsivo (desktop, tablet, móvil).
- Compatible con Chrome, Firefox, Edge.

### RNF-05: Ancho de Banda y Almacenamiento (Screenshots)
- Cada screenshot thumbnail (~640x360 JPEG Q70) debe pesar máximo 30-50 KB.
- Con 13 sesiones a intervalos de 10 segundos: ~50KB × 13 × 6/min = ~3.9 MB/min de upload por los 3 servidores combinados.
- El VPS debe soportar al menos 5 Mbps de ancho de banda de entrada.
- Los screenshots se almacenan temporalmente (solo el último por sesión, o buffer rotativo de los últimos 5 minutos). No se persisten en base de datos a largo plazo para evitar consumo excesivo de disco.

---

## 5. Restricciones Técnicas

| Restricción | Detalle |
|-------------|---------|
| Servidores son Windows 10 Pro, NO Windows Server | Las sesiones múltiples dependen de RDP Wrapper |
| RDP Wrapper puede romperse con Windows Updates | Se debe considerar mecanismo de verificación/re-parcheo |
| Tailscale es gratuito hasta 100 dispositivos | No representa limitación actual |
| Shadow Sessions requiere conexión RDP directa | No funciona vía web, solo desde PC con cliente mstsc |
| Puerto 3389 debe estar accesible | Ya configurado en firewall |
