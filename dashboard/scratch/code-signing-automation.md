# Code Signing — Automatización (Bootstrap + CI/CD) — Contexto para Gemini

Hand-off para automatizar el code signing del agente. La **firma ya está implementada** en `build-msi.ps1` (soporta `-PfxPath`/`-PfxPassword` y `-CertThumbprint`). Acá automatizamos lo que rodea a esa firma: **generar la llave una vez** y **firmar en cada release sin intervención manual**.

> Recordatorio conceptual: el certificado se genera **UNA sola vez** (no por build). Lo que se automatiza es la **firma** (cada release) y el **despliegue**. La custodia de la llave y la concesión de confianza siguen siendo actos humanos (por diseño de seguridad).

---

## 📦 Entregables (2)

| ID | Archivo | Tipo | Quién lo corre |
|----|---------|------|----------------|
| **AUTO-1** | `agent-csharp/EcaAgentSetup/ops-bootstrap-cert.ps1` | Script PowerShell | ECA, **1 sola vez** (manual, máquina segura) |
| **AUTO-2** | `.github/workflows/build-agent-msi.yml` | GitHub Actions workflow | CI, **automático** en cada release |

**Datos del repo (ya verificados):**
- Remote: `https://github.com/DazzleEaglePe/audit-dashboard-remote-desktop.git`
- Agente: **.NET 9** (`net9.0-windows`), self-contained `win-x64`.
- Instalador: **WiX v4 CLI** (`wix build`), **sin extensiones** (solo schema `v4/wxs`).
- Firma: `signtool` (viene con el Windows SDK, presente en runners `windows-latest`).
- **No existe** `.github/` todavía → crear el directorio.

---

# 🟦 AUTO-1 — `ops-bootstrap-cert.ps1` (generación de la llave, 1 vez)

**Objetivo:** que ECA genere el certificado + exporte `.pfx`/`.cer` con **un comando**, sin escribir la contraseña en texto plano dentro del script.

**Archivo nuevo:** `agent-csharp/EcaAgentSetup/ops-bootstrap-cert.ps1`

### Requisitos funcionales
- Parámetros:
  - `-Subject` (default `"CN=ECA RDP Auditing, O=ECA, C=PE"`) — ajustable.
  - `-FriendlyName` (default `"ECA Code Signing Certificate"`).
  - `-Years` (default `5`).
  - `-OutDir` (default `"."`) — dónde dejar `.pfx`/`.cer`.
- **Contraseña segura**: NO recibirla como `[string]` en texto. Pedirla con `Read-Host -AsSecureString`, o aceptar `-PfxPassword [SecureString]`. **Nunca** un `[string]` plano ni un default hardcodeado.
- Pasos que ejecuta:
  1. `New-SelfSignedCertificate -Type CodeSigningCert` con Subject/FriendlyName/NotAfter, en `Cert:\CurrentUser\My`.
  2. `Export-PfxCertificate` → `<OutDir>\ECA-CodeSign.pfx` (con la SecureString).
  3. `Export-Certificate` → `<OutDir>\ECA-CodeSign.cer`.
  4. Imprimir el **Thumbprint** (lo necesita el modo `-CertThumbprint` de `build-msi.ps1` y el CI).
- **Idempotencia/seguridad de sobrescritura**: si ya existe `ECA-CodeSign.pfx` en `OutDir`, **abortar** con mensaje claro (no sobrescribir una llave existente sin querer). Permitir `-Force` para sobrescribir explícitamente.
- Mensaje final con un recordatorio: "Guarda el .pfx offline, NO lo subas al repo, anota la fecha de expiración: <fecha>".

### Seguridad (no romper)
- La contraseña **nunca** en texto plano en el script, en logs, ni como default.
- El script **no** debe commitear ni mover el `.pfx` a ningún lado automáticamente (la custodia la decide el humano).
- Recordar que `.gitignore` ya bloquea `*.pfx`/`*.cer` (no tocar).

### Esqueleto orientativo
```powershell
param(
    [string]$Subject = "CN=ECA RDP Auditing, O=ECA, C=PE",
    [string]$FriendlyName = "ECA Code Signing Certificate",
    [int]$Years = 5,
    [string]$OutDir = ".",
    [securestring]$PfxPassword,
    [switch]$Force
)
$ErrorActionPreference = 'Stop'

$pfx = Join-Path $OutDir "ECA-CodeSign.pfx"
$cer = Join-Path $OutDir "ECA-CodeSign.cer"
if ((Test-Path $pfx) -and -not $Force) {
    Write-Error "Ya existe $pfx. Usa -Force SOLO si quieres regenerar (esto invalida la confianza ya distribuida)."
    exit 1
}
if (-not $PfxPassword) {
    $PfxPassword = Read-Host "Contraseña para proteger el .pfx" -AsSecureString
}

$cert = New-SelfSignedCertificate -Type CodeSigningCert `
    -Subject $Subject -FriendlyName $FriendlyName `
    -KeyUsage DigitalSignature -NotAfter (Get-Date).AddYears($Years) `
    -CertStoreLocation Cert:\CurrentUser\My

Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $PfxPassword | Out-Null
Export-Certificate    -Cert $cert -FilePath $cer | Out-Null

Write-Host "Thumbprint: $($cert.Thumbprint)" -ForegroundColor Green
Write-Host "Expira: $($cert.NotAfter)" -ForegroundColor Yellow
Write-Host "PFX (PRIVADO, offline): $pfx"
Write-Host "CER (público, para clientes): $cer"
```

### Verificación
- [ ] Corriendo el script genera `.pfx` + `.cer` e imprime el Thumbprint.
- [ ] Re-correrlo **sin** `-Force` aborta (no sobrescribe).
- [ ] La contraseña no aparece en el script ni en la consola en texto plano.
- [ ] `git status` no muestra el `.pfx`/`.cer` como untracked (los ignora el `.gitignore`).

---

# 🟦 AUTO-2 — `.github/workflows/build-agent-msi.yml` (firma automática en CI)

**Objetivo:** al publicar un release (o tag `v*`), el CI compila y **firma** el MSI automáticamente, leyendo la llave desde **GitHub Secrets** (nunca en el repo), y publica el `EcaAgent.msi` firmado como artefacto del release.

**Archivo nuevo:** `.github/workflows/build-agent-msi.yml`

### Estrategia de secreto (elegir UNA — recomendado: PFX en base64)
El runner de GitHub es **efímero**, así que hay que inyectarle la llave en cada corrida:
- **Opción recomendada (PFX base64):**
  - Secret `SIGNING_PFX_BASE64` = el `.pfx` codificado en base64.
    - Generar en local: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("ECA-CodeSign.pfx")) | Set-Clipboard`
  - Secret `SIGNING_PFX_PASSWORD` = la contraseña del `.pfx`.
  - El workflow decodifica el base64 a un `.pfx` temporal en el runner, firma con `-PfxPath`/`-PfxPassword`, y **borra el `.pfx`** al final (incluso si falla).
- **Alternativa (Azure Trusted Signing / cert en store):** usar `-CertThumbprint`; aplica cuando migres a CA gestionada. Documentar como camino futuro, no implementar ahora.

### Disparadores (triggers)
- `release: types: [published]` — el caso principal (cuando publicas un release en GitHub).
- `workflow_dispatch:` — para correrlo manualmente desde la pestaña Actions.
- (Opcional) `push: tags: ['v*']`.

### Runner y herramientas
- `runs-on: windows-latest` (obligatorio: signtool + target Windows + WiX).
- Pasos:
  1. `actions/checkout@v4`.
  2. `actions/setup-dotnet@v4` con `dotnet-version: '9.0.x'`.
  3. Instalar WiX v4 CLI: `dotnet tool install --global wix --version 4.*` (luego asegurar que el PATH del tool global esté disponible; en windows-latest suele estar; si no, agregar `$env:USERPROFILE\.dotnet\tools` al PATH).
  4. Decodificar el secreto a `ECA-CodeSign.pfx` temporal (en `${{ runner.temp }}`, NO en el workspace).
  5. Correr el build firmado:
     `pwsh -File build-msi.ps1 -PfxPath "<temp>\ECA-CodeSign.pfx" -PfxPassword "${{ secrets.SIGNING_PFX_PASSWORD }}"` desde `agent-csharp/EcaAgentSetup`.
  6. Borrar el `.pfx` temporal (paso con `if: always()`).
  7. `actions/upload-artifact@v4` con `EcaAgent.msi`.
  8. (Si el trigger es release) subir el MSI como **asset del release** (`softprops/action-gh-release@v2` o `gh release upload`).

### Seguridad (CRÍTICO — no romper)
- El `.pfx` y la contraseña **solo** vienen de `secrets.*`, **nunca** hardcodeados ni en el repo.
- Decodificar el `.pfx` a `runner.temp` (fuera del workspace, no se sube como artefacto).
- **Borrar el `.pfx` con `if: always()`** para que no quede ni si el build falla.
- No imprimir el secreto en logs (GitHub los enmascara, pero igual evitar `echo`).
- Si el repo es público, considerar `environment` con protección para los secrets de firma.

### Esqueleto orientativo
```yaml
name: Build & Sign Agent MSI

on:
  release:
    types: [published]
  workflow_dispatch:

jobs:
  build-msi:
    runs-on: windows-latest
    defaults:
      run:
        shell: pwsh
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '9.0.x'

      - name: Install WiX
        run: dotnet tool install --global wix --version 4.*

      - name: Decode signing certificate
        run: |
          $pfxPath = Join-Path $env:RUNNER_TEMP "ECA-CodeSign.pfx"
          [IO.File]::WriteAllBytes($pfxPath, [Convert]::FromBase64String("${{ secrets.SIGNING_PFX_BASE64 }}"))
          echo "PFX_PATH=$pfxPath" >> $env:GITHUB_ENV

      - name: Build & sign MSI
        working-directory: agent-csharp/EcaAgentSetup
        run: .\build-msi.ps1 -PfxPath "$env:PFX_PATH" -PfxPassword "${{ secrets.SIGNING_PFX_PASSWORD }}"

      - name: Cleanup certificate
        if: always()
        run: Remove-Item $env:PFX_PATH -Force -ErrorAction SilentlyContinue

      - name: Upload MSI artifact
        uses: actions/upload-artifact@v4
        with:
          name: EcaAgent-msi
          path: agent-csharp/EcaAgentSetup/EcaAgent.msi

      - name: Attach MSI to release
        if: github.event_name == 'release'
        uses: softprops/action-gh-release@v2
        with:
          files: agent-csharp/EcaAgentSetup/EcaAgent.msi
```

### Verificación
- [ ] `workflow_dispatch` corre verde y produce el artefacto `EcaAgent-msi`.
- [ ] El MSI descargado del artefacto pasa `signtool verify /pa EcaAgent.msi`.
- [ ] El log NO muestra la contraseña ni el contenido del `.pfx`.
- [ ] Tras un build fallido, el paso de cleanup igual borra el `.pfx` (revisar que corra).
- [ ] Al publicar un release, el `EcaAgent.msi` queda adjunto como asset.

---

# 🟧 PARTE OPERATIVA (ECA, NO es código — para que funcione el CI)

Esto lo haces **tú una vez** después de que Gemini cree los archivos:

1. **Correr AUTO-1** en tu máquina segura → obtienes `ECA-CodeSign.pfx` + `.cer` + Thumbprint.
2. **Cargar los secrets** en GitHub (`Settings ▸ Secrets and variables ▸ Actions`):
   - `SIGNING_PFX_BASE64` = base64 del `.pfx` (comando en AUTO-2).
   - `SIGNING_PFX_PASSWORD` = la contraseña del `.pfx`.
3. **Guardar el `.pfx` offline** (USB cifrado / Key Vault). El `.cer` se lo das a los clientes.
4. **Probar** el workflow con `workflow_dispatch` antes de atarlo a un release real.

---

# ✅ Checklist global de la automatización

### Desarrollo (Gemini)
- [ ] AUTO-1 `ops-bootstrap-cert.ps1` creado, contraseña vía SecureString, no sobrescribe sin `-Force`, imprime Thumbprint.
- [ ] AUTO-2 `.github/workflows/build-agent-msi.yml` creado (windows-latest, .NET 9, WiX v4, firma desde secrets, cleanup `if: always()`, artefacto + asset de release).
- [ ] `agent-csharp/.gitignore` ya cubre `*.pfx`/`*.cer` (verificar, no duplicar).
- [ ] Documentar en `firma-y-gpo.md` un puntero: "para CI/CD ver el workflow AUTO-2 + secrets".

### Operativo (ECA, después)
- [ ] Generar la llave con AUTO-1 (1 vez).
- [ ] Cargar `SIGNING_PFX_BASE64` + `SIGNING_PFX_PASSWORD` en GitHub Secrets.
- [ ] `.pfx` guardado offline; `.cer` listo para clientes.
- [ ] Probar con `workflow_dispatch`; validar `signtool verify /pa`.

---

# 🔒 Restricciones transversales (de todo el proyecto, no romper)
- Secretos (`.pfx`, contraseña) **nunca** en el repo, logs, línea de comando persistida ni hardcodeados.
- La firma sigue **opcional** en `build-msi.ps1` (sin args = build sin firmar). El CI solo pasa los args cuando hay secrets.
- No regenerar el certificado en cada build (rompería la confianza ya distribuida) — por eso AUTO-1 es manual y protegido con `-Force`.
- Cambios quirúrgicos; no reescribir `build-msi.ps1` (ya está aprobado).

---

# 📌 Alcance: ¿esto automatiza TODO?
- ✅ **Lado ECA (build + firma): 100% automático** tras el setup inicial.
- 🟡 **Lado cliente (confianza):** con self-signed queda **1 setup único por organización** (GPO importa el `.cer`) — ya cubierto en `firma-y-gpo.md`.
- 🔵 **Cero fricción end-to-end (incluido el cliente):** solo con CA pública (Azure Trusted Signing, ~$10/mes). `build-msi.ps1` ya lo soporta vía `-CertThumbprint`; sería cambiar el origen del cert en AUTO-2. **Futuro, no ahora.**
