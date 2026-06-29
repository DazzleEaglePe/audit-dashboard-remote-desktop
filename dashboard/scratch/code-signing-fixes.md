# Code Signing — Hallazgos del Code Review + Contexto de Fix (para Gemini)

Hand-off para corregir los 3 hallazgos del review de la implementación de **code signing** (Opción A: self-signed + GPO). La implementación base **está correcta y aprobada**; estos son ajustes de robustez/seguridad, **ninguno bloqueante**.

**Archivos involucrados:**
- `agent-csharp/EcaAgentSetup/build-msi.ps1` (FIX-1, FIX-2, FIX-3)
- `agent-csharp/EcaAgentSetup/firma-y-gpo.md` (solo nota de backlog de FIX-3)

> Regla de oro: **agregar/ajustar, no reescribir.** El script ya funciona; estos cambios son quirúrgicos.

---

## 🗺️ Mapa de hallazgos

| ID | Severidad | Archivo | Línea(s) | Tipo | Bloqueante |
|----|-----------|---------|----------|------|------------|
| FIX-1 | 🟠 Media (riesgo latente) | `build-msi.ps1` | 23, 26, 31, 33 | Code smell / colisión de variable automática | No |
| FIX-2 | 🟢 Baja (cosmético) | `build-msi.ps1` | 23–35 | Selección de versión de signtool por fecha, no por versión | No |
| FIX-3 | 🟢 Baja (seguridad/doc) | `build-msi.ps1` + doc | 62, 68, 122, 125 | Contraseña visible en línea de comando del proceso | No (dev/self-signed) |

---

## 🟠 FIX-1 — `$matches` colisiona con la variable automática de PowerShell

### Problema
Dentro de `Find-SignTool`, la variable local se llama `$matches`:
```powershell
$matches = Get-ChildItem -Path $kitsPath -Filter "signtool.exe" -Recurse ... |
           Where-Object { $_.FullName -like "*\x64\*" } |
           Sort-Object LastWriteTime -Descending
if ($matches.Count -gt 0) {
    return $matches[0].FullName
}
```
`$Matches` (case-insensitive en PowerShell) es una **variable automática** que el motor llena automáticamente cuando se usa el operador `-match`, `switch -regex` o `Select-String`. Asignarle un valor propio es una mala práctica: si más adelante alguien agrega un `-match` en esa función (o refactoriza), el valor se **sobrescribe silenciosamente** y el bug es muy difícil de rastrear.

### Por qué importa
- Hoy **funciona** porque dentro de la función no hay ningún `-match`. Es un riesgo **latente**, no un bug activo.
- Es exactamente el tipo de trampa que rompe en el peor momento (un refactor inocente).

### Fix
Renombrar la variable a un nombre propio (ej. `$signtoolMatches` y `$signtoolMatchesAny`) en las **4 apariciones**:

```powershell
# Try to find x64 version first
$signtoolMatches = Get-ChildItem -Path $kitsPath -Filter "signtool.exe" -Recurse -ErrorAction SilentlyContinue |
                   Where-Object { $_.FullName -like "*\x64\*" } |
                   Sort-Object LastWriteTime -Descending
if ($signtoolMatches.Count -gt 0) {
    return $signtoolMatches[0].FullName
}

# Fallback to any version if x64 isn't found
$signtoolMatchesAny = Get-ChildItem -Path $kitsPath -Filter "signtool.exe" -Recurse -ErrorAction SilentlyContinue |
                      Sort-Object LastWriteTime -Descending
if ($signtoolMatchesAny.Count -gt 0) {
    return $signtoolMatchesAny[0].FullName
}
```

### Verificación
- [ ] `Find-SignTool` sigue devolviendo la ruta correcta de `signtool.exe`.
- [ ] No quedan referencias a `$matches` en `build-msi.ps1` (búsqueda case-insensitive).

---

## 🟢 FIX-2 — Elegir signtool por versión del SDK, no por fecha de archivo

### Problema
La selección de la "más nueva" usa `Sort-Object LastWriteTime -Descending`:
```powershell
... | Sort-Object LastWriteTime -Descending
```
La fecha de modificación del archivo **no garantiza** que sea la versión más reciente del SDK (un reinstalo, un copy, o un Windows Update puede alterar las fechas). Las versiones del SDK viven en carpetas tipo `...\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe`, y ese número de versión es la fuente de verdad.

### Por qué importa
- Cosmético. Cualquier `signtool` reciente firma igual de bien.
- Pero ordenar por la **versión** (que está en el path) es determinista y más correcto.

### Fix (opcional)
Ordenar por el número de versión extraído del path en vez de por fecha. Ejemplo robusto:
```powershell
$signtoolMatches = Get-ChildItem -Path $kitsPath -Filter "signtool.exe" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -like "*\x64\*" } |
    Sort-Object {
        # Extraer "10.0.22621.0" del path y convertirlo a [version] para ordenar correctamente
        if ($_.FullName -match '\\10\\bin\\([\d.]+)\\') { [version]$matches[1] } else { [version]'0.0' }
    } -Descending
```
> ⚠️ Nota: este snippet **sí** usa `$matches` legítimamente (lo llena el `-match` del scriptblock de `Sort-Object`). Eso es correcto y es justamente por qué FIX-1 importa: no mezclar el `$matches` automático con una variable propia.

### Verificación
- [ ] En una máquina con varias versiones del SDK instaladas, devuelve la de **mayor número de versión**.
- [ ] Si no encuentra el patrón de versión, no crashea (cae al fallback `[version]'0.0'`).

---

## 🟢 FIX-3 — Contraseña del `.pfx` visible en la línea de comando del proceso

### Problema
La firma pasa la contraseña con `/p`:
```powershell
& $signtoolPath sign /fd SHA256 /f $PfxPath /p $PfxPassword /tr http://timestamp.digicert.com /td SHA256 $target
```
Mientras `signtool.exe` se ejecuta, su **línea de comando completa** (incluida la contraseña) es visible para cualquier proceso del sistema que liste procesos:
```powershell
Get-CimInstance Win32_Process | Where-Object Name -eq 'signtool.exe' | Select CommandLine
```
La contraseña **no** queda en el repo, ni en logs, ni en el script (eso ya está bien). El leak es solo en memoria/lista de procesos **durante** la firma.

### Por qué importa
- Es una **limitación conocida de `signtool /p`**, no un error de la implementación.
- Para **dev / self-signed local** es aceptable (la máquina de build es de confianza).
- Importa **si algún día se firma en un CI compartido / runner multi-tenant**, donde otro proceso podría estar espiando.

### Fix recomendado (no urgente — decidir alcance)
Hay dos caminos; **elegir uno**:

**Opción A (mínima, recomendada ahora):** dejar el código como está y **documentar** la limitación + el camino de hardening en el runbook. Agregar a `firma-y-gpo.md` una nota:
> ⚠️ Para firma en pipelines compartidos, no usar `/p` con la contraseña en texto. Importar el `.pfx` al almacén de certificados del runner y firmar por huella con `signtool sign /sha1 <thumbprint> ...`, evitando exponer la contraseña en la línea de comando.

**Opción B (hardening real, para cuando haya CI):** soportar firma **por thumbprint** desde el store, además del `.pfx`:
- Nuevo parámetro opcional `-CertThumbprint`.
- Si se pasa `-CertThumbprint` → `& $signtoolPath sign /sha1 $CertThumbprint /fd SHA256 /tr ... /td SHA256 $target` (sin `/f` ni `/p`).
- Si se pasa `-PfxPath`/`-PfxPassword` → comportamiento actual (dev local).
- Mantener ambos modos; el de thumbprint no expone secreto.

### Verificación
- Opción A: [ ] La nota está en `firma-y-gpo.md`.
- Opción B: [ ] Con `-CertThumbprint` firma sin `/f`/`/p`; `signtool verify /pa` OK; `Get-CimInstance` no muestra contraseña.

---

## ✅ Orden sugerido para Gemini
1. **FIX-1** (obligatorio, 4 renombres) — elimina el riesgo latente.
2. **FIX-2** (opcional pero barato) — ordenar por versión; **aprovecha** el `$matches` legítimo del `-match`.
3. **FIX-3 Opción A** (doc) — agregar la nota de hardening al runbook. Dejar Opción B para el sprint de CI.

## 🔒 Restricciones a respetar (no romper)
- La firma sigue siendo **opcional**: sin `-PfxPath` (ni `-CertThumbprint`), el build compila **sin firmar** como hoy.
- La contraseña **nunca** hardcodeada, logueada ni commiteada.
- `.gitignore` ya cubre `*.pfx`/`*.cer`/`*.snk` — no tocar.
- No reescribir el script: cambios quirúrgicos sobre `Find-SignTool` y (FIX-3 B) el bloque de firma.

## 🧪 Validación final (tras aplicar)
```powershell
# 1. Build SIN firma (debe compilar el MSI como hoy)
.\build-msi.ps1

# 2. Build CON firma self-signed (debe firmar binarios + MSI y verificar)
.\build-msi.ps1 -PfxPath ".\ECA-CodeSign.pfx" -PfxPassword "..."
# Esperado: 'signtool verify /pa EcaAgent.msi' => Successfully verified
```
