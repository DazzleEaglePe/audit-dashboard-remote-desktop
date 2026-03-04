# Configuración de Infraestructura Existente — Detalle Técnico

## 1. Configuración de RDP Wrapper

### 1.1 Versión Instalada
- **Fork:** sebaxakerhtc/rdpwrap (https://github.com/sebaxakerhtc/rdpwrap/releases)
- **RDP Wrapper Library:** v1.6.2+ / v1.7.4.0+
- **Ubicación ejecutables:** `C:\RDPWrap\` (RDPWInst.exe, RDPConf.exe, RDPCheck.exe)
- **Ubicación INI:** `C:\Program Files\RDP Wrapper\rdpwrap.ini`

### 1.2 Problema Resuelto: Build No Soportada
La versión de Windows 10 Pro de los servidores (build `10.0.19041.6926`) no estaba incluida en el `rdpwrap.ini` oficial. Se resolvió agregando manualmente un nuevo bloque al INI basado en la configuración del bloque más cercano (`[10.0.19041.6456]`).

**Bloque agregado:**
```ini
[10.0.19041.6926]
LocalOnlyPatch.x86=1
LocalOnlyOffset.x86=C2659
LocalOnlyCode.x86=jmpshort
SingleUserPatch.x86=1
SingleUserOffset.x86=45BB7
SingleUserCode.x86=pop_eax_add_esp_12_nop_2
DefPolicyPatch.x86=1
DefPolicyOffset.x86=41B49
DefPolicyCode.x86=CDefPolicy_Query_eax_ecx
SLInitHook.x86=1
SLInitOffset.x86=70B68
SLInitFunc.x86=New_CSLQuery_Initialize
LocalOnlyPatch.x64=1
LocalOnlyOffset.x64=91A61
LocalOnlyCode.x64=jmpshort
SingleUserPatch.x64=1
SingleUserOffset.x64=1842B
SingleUserCode.x64=mov_eax_1_nop_2
DefPolicyPatch.x64=1
DefPolicyOffset.x64=1F415
DefPolicyCode.x64=CDefPolicy_Query_eax_rcx
SLInitHook.x64=1
SLInitOffset.x64=2902C
SLInitFunc.x64=New_CSLQuery_Initialize
```

### 1.3 Estado Verificado (todos los servidores)
```
Wrapper state:  Installed  ✅
Service state:  Running    ✅
Listener state: Listening  ✅
Version:        [fully supported] ✅
Single session per user: Desmarcado ✅
```

### 1.4 Procedimiento de Recuperación Post-Update
Si Windows Update cambia la versión de `termsrv.dll`:
1. Abrir `RDPConf.exe` y verificar si dice `[not supported]`
2. Obtener nueva versión: `wmic datafile where name="C:\\Windows\\System32\\termsrv.dll" get version`
3. Buscar en `rdpwrap.ini` el bloque más cercano a la nueva versión
4. Copiar bloque, cambiar el número de versión en el header
5. Guardar INI, reiniciar servicio: `net stop TermService /y && net start TermService`
6. Verificar con `RDPConf.exe`

---

## 2. Configuración de Políticas de Grupo

Aplicado en cada servidor vía `gpedit.msc`:

```
Configuración del equipo
  → Plantillas administrativas
    → Componentes de Windows
      → Servicios de Escritorio remoto
        → Host de sesión de Escritorio remoto
          → Conexiones

Políticas configuradas:
  "Limitar número de conexiones" → Habilitada, valor: 10
  "Restringir usuarios a una única sesión" → Deshabilitada
```

---

## 3. Configuración de Firewall

### 3.1 Reglas Habilitadas (Script Habilitar_Monitoreo_RDP.bat)

```cmd
:: Regla para SMB (consultas remotas qwinsta)
netsh advfirewall firewall add rule name="ECA - Remote Query Sessions SMB" dir=in action=allow protocol=tcp localport=445

:: Regla para RPC Endpoint Mapper
netsh advfirewall firewall add rule name="ECA - Remote Query Sessions RPC" dir=in action=allow protocol=tcp localport=135

:: Regla para RPC Dynamic Ports
netsh advfirewall firewall add rule name="ECA - Remote Query Sessions RPC Dynamic" dir=in action=allow protocol=tcp localport=49152-65535

:: WMI
netsh advfirewall firewall set rule group="Windows Management Instrumentation (WMI)" new enable=yes

:: Escritorio Remoto (ya habilitado)
netsh advfirewall firewall set rule group="Escritorio remoto" new enable=Yes
```

### 3.2 Puerto RDP
- Puerto: **3389/TCP**
- Estado: Abierto en firewall
- Conexiones: Permitidas desde red privada y pública

---

## 4. Configuración de Registro (Registry)

```cmd
:: Shadow RDP sin consentimiento del usuario (valor 2 = observar sin pedir permiso)
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services" /v Shadow /t REG_DWORD /d 2 /f

:: Permitir RPC remoto (necesario para qwinsta remoto)
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services" /v AllowRemoteRPC /t REG_DWORD /d 1 /f
```

**Valores de Shadow:**
| Valor | Comportamiento |
|-------|---------------|
| 0 | Shadow deshabilitado |
| 1 | Observar CON consentimiento del usuario |
| 2 | Observar SIN consentimiento (configuración actual) |
| 3 | Control remoto CON consentimiento |
| 4 | Control remoto SIN consentimiento |

---

## 5. Servicios de Windows Configurados

| Servicio | Nombre Técnico | Estado | Inicio |
|----------|---------------|--------|--------|
| Servicios de Escritorio Remoto | TermService | Running | Automático |
| Registro Remoto | RemoteRegistry | Running | Automático |
| WMI (Instrumentación) | Winmgmt | Running | Automático |
| WinRM | WinRM | Running | Automático |

---

## 6. Configuración de Tailscale

### 6.1 Instalación
Tailscale instalado desde https://tailscale.com en cada servidor y en la PC supervisora.

### 6.2 Red Mesh

| Dispositivo | IP Tailscale | Estado |
|-------------|-------------|--------|
| Servidor 1 (DESKTOP-E4F6THB) | 100.108.248.45 | Activo |
| Servidor 2 (DESKTOP-TR7OGR1) | 100.112.15.36 | Activo |
| Servidor 3 (DESKTOP-LKSNKOL) | 100.109.28.98 | Activo |
| PC Supervisora (Bruno) | (variable) | Activo |

### 6.3 Funcionalidad
- Permite acceso RDP desde cualquier ubicación usando las IPs 100.x.x.x
- Permite ejecutar el script de monitoreo en modo Tailscale desde casa
- Conexión encriptada WireGuard
- No requiere port forwarding ni IP pública
- Gratis hasta 100 dispositivos

---

## 7. Configuración de CONCAR SQL

### 7.1 Instalación
- **Ruta:** `C:\RSCONCAR\RSCONCAR.exe`
- **Versión:** CONCAR SQL v.14.25
- **Base de datos:** SQL Server 2022 (instancia local en Servidor 1)

### 7.2 Permisos de Acceso
```
C:\RSCONCAR\ → Propiedades → Seguridad
  Usuarios (DESKTOP-xxxx\Usuarios): Control total ✅
```

### 7.3 Acceso Directo Público
```
C:\Users\Public\Desktop\CONCAR SQL → apunta a C:\RSCONCAR\RSCONCAR.exe
```
Todos los usuarios que inician sesión RDP ven el ícono de CONCAR en su escritorio automáticamente.

---

## 8. Usuarios del Sistema

### 8.1 Comandos de Creación (referencia)

```cmd
:: Crear usuario
net user CONT Password123* /add

:: Agregar al grupo de Escritorio Remoto
net localgroup "Usuarios de escritorio remoto" CONT /add
```

### 8.2 Verificación

```cmd
:: Ver usuarios conectados en un servidor
query user
qwinsta /server:192.168.18.4

:: Ver miembros del grupo RDP
net localgroup "Usuarios de escritorio remoto"
```

---

## 9. Comandos de Referencia Rápida

```cmd
:: ─── VERIFICACIÓN ───
winver                                    # Versión de Windows
wmic datafile where name="C:\\Windows\\System32\\termsrv.dll" get version  # Versión termsrv.dll
query user                                # Usuarios conectados (local)
qwinsta /server:192.168.18.4              # Usuarios conectados (remoto)

:: ─── SERVICIOS ───
net stop TermService /y                   # Detener servicio RDP
net start TermService                     # Iniciar servicio RDP
net start RemoteRegistry                  # Iniciar Registro Remoto

:: ─── SHADOW (AUDITORÍA) ───
mstsc /shadow:2 /v:192.168.18.4 /noConsentPrompt   # Shadow sesión ID 2 (solo ver)

:: ─── RDP WRAPPER ───
RDPConf.exe                               # Verificar estado del wrapper
RDPCheck.exe                              # Probar conexión local

:: ─── POLÍTICAS ───
gpedit.msc                                # Editor de políticas de grupo
gpupdate /force                           # Forzar actualización de políticas

:: ─── FIREWALL ───
firewall.cpl                              # Panel de control de firewall

:: ─── DIAGNÓSTICO ───
ping 192.168.18.4                         # Test conectividad LAN
ping 100.108.248.45                       # Test conectividad Tailscale
ipconfig                                  # Ver configuración de red
```
