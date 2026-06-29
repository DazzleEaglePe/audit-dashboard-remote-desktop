# Plan — Code Signing del MSI (Opción A: self-signed + GPO)
Separa lo que es **DESARROLLO** (código/scripts → Gemini) de lo que es **OPERATIVO** (configuración/actos manuales → ECA o cliente).

---

## 🧭 Resumen: ¿desarrollo u operativo?
| Bloque | Tipo | Quién | Frecuencia |
|---|---|---|---|
| Paso de firma en `build-msi.ps1` | 🟦 **DESARROLLO** | Gemini | 1 vez (código) |
| `install-trust.ps1` (script de confianza del cliente) | 🟦 **DESARROLLO** | Gemini | 1 vez (código) |
| `firma-y-gpo.md` (doc/runbook) | 🟦 **DESARROLLO** (doc) | Gemini | 1 vez |
| Generar el cert + `.pfx` | 🟧 **OPERATIVO** | ECA | 1 vez (~5 años) |
| Proteger/guardar el `.pfx` + contraseña | 🟧 **OPERATIVO** | ECA | continuo |
| Configurar el secreto del `.pfx` en CI (si aplica) | 🟧 **OPERATIVO** | ECA | 1 vez |
| Ejecutar `install-trust.ps1` / GPO | 🟧 **OPERATIVO** | Cliente | 1 vez/cliente |

> En una frase: **Gemini construye los scripts (desarrollo); ECA genera y protege la llave + el cliente confía (operativo).**

---

# 🟦 PARTE 1 — DESARROLLO (para Gemini)

## DEV-1 — Agregar paso de firma a `build-msi.ps1`
**Archivo:** `agent-csharp/EcaAgentSetup/build-msi.ps1` (ya existe; **agregar**, no reescribir)
**Requisitos:**
- Parámetros nuevos opcionales: `-PfxPath` y `-PfxPassword` (o `-CertThumbprint`).
- **Si NO se pasan** → build normal **sin firmar** (para pruebas locales). No debe romper el flujo actual.
- **Si se pasan** → firmar en este orden:
  1. Firmar los **binarios** del agente (`publish\EcaMonitorAgent.exe` y `.dll` propios) **ANTES** de empaquetar.
  2. Construir el MSI (paso actual).
  3. Firmar el **MSI** al final.
  4. `signtool verify /pa` sobre el MSI.
- Comando de firma:
  ```powershell
  & $signtool sign /fd SHA256 /f $PfxPath /p $PfxPassword `
    /tr http://timestamp.digicert.com /td SHA256 $target
  ```
- **Resolver la ruta de `signtool.exe`** (no está en PATH por defecto): buscar en
  `${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe` (tomar la versión más nueva); si no está, error claro "instala el Windows SDK".
- **Seguridad:** `-PfxPassword` NUNCA hardcodeado; leerlo de parámetro/variable de entorno. No loguear la contraseña.
**Verificación:**
- [ ] Sin `-PfxPath` → build genera MSI sin firma (como hoy).
- [ ] Con `.pfx` → binarios y MSI firmados; `signtool verify /pa` OK.

## DEV-2 — Crear `install-trust.ps1` (script de confianza del cliente)
**Archivo nuevo:** `agent-csharp/EcaAgentSetup/install-trust.ps1`
**Qué hace:** el admin del cliente lo corre **una vez** (como Administrador) para que sus PCs confíen en el cert de ECA.
```powershell
#Requires -RunAsAdministrator
param([string]$CerPath = ".\ECA-CodeSign.cer")
if (-not (Test-Path $CerPath)) { Write-Error "No se encontró $CerPath"; exit 1 }
Import-Certificate -FilePath $CerPath -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
Import-Certificate -FilePath $CerPath -CertStoreLocation Cert:\LocalMachine\TrustedPublisher | Out-Null
Write-Host "Certificado de ECA importado en Trusted Root + Trusted Publishers." -ForegroundColor Green
```
**Requisitos:**
- Exigir privilegios de admin (`#Requires -RunAsAdministrator`).
- **Idempotente** (re-correrlo no rompe nada).
- Importar en **AMBOS** stores: `Root` (cadena) **y** `TrustedPublisher` (ejecución sin prompt) — clave para self-signed.
- Mensajes claros de éxito/error.
**Verificación:**
- [ ] Tras correrlo, instalar el MSI firmado → **sin** "editor desconocido".
- [ ] Sin correrlo → el MSI muestra "editor desconocido" (confirma que el script es lo que habilita la confianza).

## DEV-3 — Crear `firma-y-gpo.md` (runbook)
**Archivo nuevo:** `agent-csharp/EcaAgentSetup/firma-y-gpo.md`
**Contenido:**
- **Para ECA**: comandos del Nivel 1 (generar cert, exportar `.pfx` y `.cer`).
- **Para el cliente**: cómo usar `install-trust.ps1` en 1 PC, **o** importar el `.cer` por GPO de dominio (Trusted Root + Trusted Publishers) para todas las máquinas.
- Advertencias de seguridad (proteger el `.pfx`, no commitearlo).

---

# 🟧 PARTE 2 — OPERATIVO (para ECA / cliente, NO es código)

## OPS-1 — Generar y proteger el certificado (ECA, 1 vez)
- [ ] En una **máquina segura**, correr `New-SelfSignedCertificate` (ver `firma-y-gpo.md`).
- [ ] Exportar `ECA-CodeSign.pfx` (privado, con contraseña fuerte) y `ECA-CodeSign.cer` (público).
- [ ] Guardar el `.pfx` **cifrado y offline**, acceso restringido. **Nunca** en el repo/CI plano/correo.
- [ ] Anotar fecha de expiración (renovar antes de ~5 años).

## OPS-2 — Configurar secreto en CI (solo si firmas en pipeline)
- [ ] Subir el `.pfx` (base64) + contraseña como **secretos del CI**.
- [ ] El job de build inyecta `-PfxPath`/`-PfxPassword` desde esos secretos.

## OPS-3 — Onboarding del cliente (por cliente, 1 vez)
- [ ] Entregar al cliente: `EcaAgent.msi` (firmado) + `ECA-CodeSign.cer` + `install-trust.ps1`.
- [ ] El cliente corre `install-trust.ps1` (1 PC) **o** importa el `.cer` por GPO (dominio).
- [ ] Desplegar el MSI por GPO/RMM silencioso.

---

# ✅ Criterios de aceptación (todo el flujo)
- [ ] `build-msi.ps1` firma binarios + MSI cuando se le pasa el `.pfx`; sin él, build normal.
- [ ] `signtool verify /pa EcaAgent.msi` → OK.
- [ ] En una PC con el cert confiado (vía `install-trust.ps1`/GPO), el MSI instala **sin "editor desconocido"**.
- [ ] El `.pfx` y la contraseña **no** están en el repo ni en logs.
- [ ] `.gitignore` ignora `*.pfx`, `*.cer`, `*.snk` (artefactos de firma).

# 📌 Notas
- Requiere **Windows + Windows SDK** (trae `signtool`).
- La firma con `/tr` (timestamp) hace que el MSI siga válido **aunque el cert expire**.
- Si a futuro escalas a muchos clientes → **Opción B** (CA pública / Azure Trusted Signing) elimina OPS-3 (el cliente ya no corre `install-trust.ps1`). El `build-msi.ps1` de DEV-1 sirve igual (solo cambia el origen del cert).
