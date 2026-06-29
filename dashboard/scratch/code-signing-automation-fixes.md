# Code Signing Automation — Hallazgos del Review + Contexto de Fix (para Gemini)

Hand-off para corregir los hallazgos del review de **AUTO-2** (`.github/workflows/build-agent-msi.yml`). AUTO-1 (`ops-bootstrap-cert.ps1`) **quedó aprobado** — solo tiene notas menores opcionales al final. Ningún cambio reescribe archivos: son ajustes quirúrgicos al `.yml`.

**Archivo principal:** `.github/workflows/build-agent-msi.yml`

---

## 🗺️ Mapa de hallazgos

| ID | Severidad | Archivo | Acción | Bloqueante |
|----|-----------|---------|--------|------------|
| **F-B** | 🔴 Probable fallo | `build-agent-msi.yml` | Agregar `permissions: contents: write` | **Sí** (el asset al release falla con 403) |
| **F-A** | 🟠 Hardening | `build-agent-msi.yml` | Pasar secrets vía bloque `env:`, no inline | Recomendado |
| **F-C** | 🟢 Menor | `build-agent-msi.yml` | Fijar versión de WiX (no `4.*`) | No |
| **F-D** | 🟢 Verificar | `build-agent-msi.yml` | Confirmar PATH de `wix` en el runner | No |

---

## 🔴 F-B — Falta `permissions: contents: write` (el paso de release fallará con 403)

### Problema
El paso `Attach MSI to release` usa `softprops/action-gh-release@v2`, que necesita **escritura** sobre el repo para subir el asset. En muchos repos el `GITHUB_TOKEN` viene **read-only por defecto** → ese paso falla con **HTTP 403**.

### Fix
Agregar un bloque `permissions` al job (mínimo privilegio: solo `contents: write`):
```yaml
jobs:
  build-msi:
    runs-on: windows-latest
    permissions:
      contents: write
    defaults:
      run:
        shell: pwsh
    steps:
      ...
```

### Verificación
- [ ] Al publicar un release, el step `Attach MSI to release` sube `EcaAgent.msi` como asset sin 403.

---

## 🟠 F-A — Pasar los secrets por bloque `env:`, no interpolados inline

### Problema
Hoy el secreto se interpola directo dentro del `run:`:
```yaml
run: .\build-msi.ps1 -PfxPath "$env:PFX_PATH" -PfxPassword "${{ secrets.SIGNING_PFX_PASSWORD }}"
```
La **recomendación oficial de GitHub** es inyectar secrets vía bloque `env:` del step. Razones: evita que un valor con caracteres especiales rompa el parseo del shell (y potencialmente exponga el secreto), y es más robusto que depender solo del enmascarado de logs. Aplica también al `base64` del paso de decodificación.

### Fix
**Paso de decodificación** — mover el base64 a `env:`:
```yaml
      - name: Decode signing certificate
        env:
          PFX_BASE64: ${{ secrets.SIGNING_PFX_BASE64 }}
        run: |
          $pfxPath = Join-Path $env:RUNNER_TEMP "ECA-CodeSign.pfx"
          [IO.File]::WriteAllBytes($pfxPath, [Convert]::FromBase64String($env:PFX_BASE64))
          "PFX_PATH=$pfxPath" >> $env:GITHUB_ENV
```
**Paso de build/firma** — mover la contraseña a `env:`:
```yaml
      - name: Build & sign MSI
        working-directory: agent-csharp/EcaAgentSetup
        env:
          PFX_PASSWORD: ${{ secrets.SIGNING_PFX_PASSWORD }}
        run: .\build-msi.ps1 -PfxPath "$env:PFX_PATH" -PfxPassword "$env:PFX_PASSWORD"
```
> Nota: la password igual termina en la línea de comando de `signtool` dentro de `build-msi.ps1` (modo `/p`) — es el FIX-3 ya conocido. El camino limpio definitivo es `-CertThumbprint` cuando se migre a CA gestionada. Para CI efímero es aceptable. **No** cambiar `build-msi.ps1` aquí.

### Verificación
- [ ] El workflow corre verde con los secrets vía `env:`.
- [ ] El log no muestra el secreto (seguir sin `echo` de los valores).

---

## 🟢 F-C — Fijar la versión de WiX (reproducibilidad)

### Problema
```yaml
run: dotnet tool install --global wix --version 4.*
```
El wildcard `4.*` instala la última 4.x disponible en cada corrida → un build de hace meses podría no recompilar idéntico (y un cambio menor de WiX podría romper algo silenciosamente).

### Fix
Fijar una versión concreta y estable de la línea 4.x (verificar la más reciente 4.x en nuget.org al momento; ejemplo):
```yaml
run: dotnet tool install --global wix --version 4.0.5
```

### Verificación
- [ ] El step instala exactamente la versión fijada.
- [ ] `wix build` compila el MSI sin errores con esa versión.

---

## 🟢 F-D — Verificar que `wix` esté en el PATH del step de build

### Problema
`dotnet tool install --global wix` instala en `%USERPROFILE%\.dotnet\tools`. En `windows-latest` ese directorio **suele** estar en el PATH (lo agrega `setup-dotnet`), pero conviene asegurarlo: si el step de `build-msi.ps1` no encuentra `wix`, el build falla en `wix build`.

### Fix (defensivo, solo si hiciera falta)
Agregar el path de herramientas globales al PATH del runner tras instalar WiX:
```yaml
      - name: Install WiX
        run: |
          dotnet tool install --global wix --version 4.0.5
          "$env:USERPROFILE\.dotnet\tools" >> $env:GITHUB_PATH
```
`>> $env:GITHUB_PATH` lo deja disponible para todos los steps siguientes.

### Verificación
- [ ] El step `Build & sign MSI` encuentra `wix` (no falla con "command not found").

---

## 🟢 Notas menores de AUTO-1 (`ops-bootstrap-cert.ps1`) — OPCIONALES
No bloquean; aplicar solo si se quiere pulir:
- El guard de sobrescritura solo chequea el `.pfx`, no el `.cer`. Caso raro (pfx borrado, cer presente) sobrescribiría el `.cer`. Se podría extender el chequeo a ambos.
- Con `-Force`, `New-SelfSignedCertificate` crea un cert nuevo en `Cert:\CurrentUser\My` cada vez → se acumulan. Opcional: limpiar certs viejos con el mismo Subject antes de crear, o solo documentarlo.

---

## ✅ Orden sugerido
1. **F-B** (obligatorio) — `permissions: contents: write`.
2. **F-A** (recomendado) — secrets vía `env:` en los 2 steps.
3. **F-C** (menor) — fijar versión de WiX.
4. **F-D** (defensivo) — PATH de `wix` (aplicar de una junto a F-C, no cuesta nada).

## 🔒 Restricciones (no romper)
- Secrets **solo** desde `secrets.*`, nunca hardcodeados ni en logs.
- `build-msi.ps1` **no se toca** (ya aprobado; sigue con firma opcional).
- Cleanup del `.pfx` con `if: always()` debe permanecer.
- Decodificar el `.pfx` a `RUNNER_TEMP` (fuera del workspace), nunca al repo.

## 🧪 Validación final (tras aplicar)
- [ ] `workflow_dispatch` corre verde y genera el artefacto `EcaAgent-msi`.
- [ ] El MSI del artefacto pasa `signtool verify /pa EcaAgent.msi`.
- [ ] Un release publicado adjunta el `EcaAgent.msi` como asset (sin 403).
- [ ] El log no expone la contraseña ni el contenido del `.pfx`.
