# AUDITORIA-ECA — Contexto Global del Proyecto + Fixes Pendientes
Documento de hand-off para continuar el desarrollo (con Gemini) y aplicar los ajustes pendientes.

---

## 1. ¿Qué es el proyecto?
Plataforma SaaS **multi-tenant** de auditoría/monitoreo de escritorios remotos (RDP):
- **dashboard/** — Next.js 16 (App Router) + server custom con Socket.io + Drizzle ORM (PostgreSQL) + Redis adapter (escalado multi-nodo). Panel web por tenant.
- **agent-csharp/** — Agente .NET (Windows Service) que reporta métricas/sesiones (HTTP) y capturas (WebSocket).
- **license-server/** + **license-admin/** — Licenciamiento on-premise Ed25519 (estilo ESET) + panel Vite/React para emitir claves.

## 2. ¿Qué se construyó? (estado por bloque)

### A. UX / Theming — ✅ COMPLETO
- Light/Dark/**System** automático en **dashboard** (next-themes, `defaultTheme="system"`) y **license-admin** (provider + ModeToggle propios).
- Migración total de colores hardcodeados → **tokens semánticos** (oklch). Cero `slate/hex` que rompan el tema.
- Skeleton con shimmer, botones con micro-interacciones, `tabular-nums`, empty states, responsive validado.

### B. Multi-tenant dinámico de servidores — ✅ COMPLETO
- `useServers()` hook reactivo (`server:update`), columna `servers.name` editable, 5 índices de performance.
- `verifyAndRegisterServer` idempotente (`onConflictDoNothing` + re-verificación de ownership).
- **Binding por-equipo enforzado** (`device_id === server_id`) en heartbeat/event/socket.
- Eliminados hardcodes `srv1/2/3` y `USER_DIRECTORY`.

### C. Enrolamiento estilo ESET/AnyDesk
- **Fase 1 (backend)** ✅ — tabla `enrollment_tokens`, `POST /api/agent/enroll` (transacción + `for('update')` para cupo, credencial por-equipo `eca_dev_`, doble límite de licencia, auditoría, fail-secure), CRUD de tokens en Settings.
- **Fase 1-B (agente C#)** ✅ — `EnrollmentManager`: GUID persistido, DPAPI (`LocalMachine`) + ACLs, descarte del token, idempotencia, backoff/429, re-enroll seguro ante 401 (detiene si no hay token).
- **Fase 2 (instalador MSI)** ✅ (a falta de firma) — WiX + Windows Service (`UseWindowsService`), token efímero embebido vía `CustomActionData` (JScript `write-config.js`, sin exponer el token en línea de comando, URL validada por regex), endpoints `download` (auth admin + `private/` + stream), `deregister` (auditado + limpia server huérfano), `version` (mock).

### D. Pruebas E2E — ✅ implementadas (con fixes pendientes, ver §4)
- `e2e-auto-validation.ps1` (suite automatizada vía enroll real), `seed_e2e_tenants.js`, `clean_db.js`, `e2e-test-plan.md`.

## 3. Principios de seguridad aplicados (no romper)
- El `tenant_id` SIEMPRE se deriva server-side (API key / token / JWT) — el cliente nunca lo declara.
- Aislamiento total entre tenants (DB scoped + rooms `tenant:<id>`).
- Token de enroll = bootstrap **efímero/revocable**; el equipo lo canjea por credencial **por-equipo bindeada** (token exchange).
- Credenciales cifradas en reposo (DPAPI) + ACLs; secretos nunca en texto plano ni en línea de comando.

---

## 4. FIXES PENDIENTES (accionables — para Gemini)

### 🔴 FIX-1 — Tokens deterministas en el seed (repetibilidad de la suite E2E)
**Problema:** `e2e-auto-validation.ps1` tiene tokens **hardcodeados**, pero `seed_e2e_tenants.js` genera tokens **aleatorios** cada corrida → se desincronizan → toda la suite falla con 403.
**Archivo:** `dashboard/scratch/seed_e2e_tenants.js`
**Fix:** usar tokens fijos deterministas:
```js
const rawTokenA = 'eca_enroll_E2E_TENANT_A_FIXED_TOKEN_000000000000000000';
const rawTokenB = 'eca_enroll_E2E_TENANT_B_FIXED_TOKEN_000000000000000000';
const hashA = crypto.createHash('sha256').update(rawTokenA).digest('hex');
const hashB = crypto.createHash('sha256').update(rawTokenB).digest('hex');
```
Y poner esos **mismos** valores en `$TOKEN_A`/`$TOKEN_B` de `e2e-auto-validation.ps1`.
**Verificación:** correr clean→seed→validate dos veces seguidas → ambos PASS sin tocar nada.

### 🟠 FIX-2 — El smoke-test usa api_keys que el seed no crea
**Problema:** `multitenant-smoke-test.ps1` usa `eca_key_tenantA_smoke_test_key_123`, pero el seed no inserta esas `api_keys` → V2 falla (401).
**Opción A (recomendada):** **retirar** `multitenant-smoke-test.ps1` — `e2e-auto-validation.ps1` ya cubre y supera lo que hacía (usa enroll real).
**Opción B:** agregar al seed las `api_keys` con `key_hash = sha256('eca_key_tenantA_smoke_test_key_123')` (y la de B), con `tenant_id` correspondiente y `device_id` null (key legada por-tenant).

### 🟢 FIX-3 — Endurecer workflow de los scripts E2E
- Los `.js` deben correrse desde `dashboard/` (donde están `pg`/`bcryptjs`) y con el server en `localhost:3000`.
- Orden obligatorio: **clean → seed → validate**. Re-correr el validador sin limpiar acumula devices y rompe F2/G3.
- (Opcional) crear un `run-e2e.ps1` que encadene: `node clean_db.js; node seed_e2e_tenants.js; pwsh e2e-auto-validation.ps1`.
- Confirmar que `scratch/` esté en `.gitignore` (los scripts tienen la password de DB) e idealmente leer `DATABASE_URL` de env en vez de hardcodearla.

### 🟢 FIX-4 — Corrección menor de la suite
- En `e2e-auto-validation.ps1`, el comentario de FASE D dice "simula reinicio"; en realidad un agente real **no** re-enrola al reiniciar (reusa la cred DPAPI). El test valida la **rotación server-side** del re-enroll (válido) — solo ajustar el comentario para no confundir.
- Asegurar que la **licencia global** de prueba tenga cupo suficiente (la suite crea ~4 devices); si `max_servers` global < 4, F3/G3 fallarían por el límite global, no por el del tenant.

---

## 5. Backlog / mejoras a futuro (no bloqueantes)
- **Code signing** del MSI + binarios (signtool + cert OV/EV en HSM) — proceso, pendiente para producción.
- **Auto-update real**: el endpoint `/api/agent/version` es un mock (`1.0.0`); implementar comparación + descarga firmada.
- **De-registro en uninstall**: cablear la CA de uninstall para llamar `/api/agent/deregister` (hoy solo limpia local; la key del device queda en server hasta revocarla).
- **Managed Custom Action (C#)** en vez de JScript en el MSI (más robusto, menos falsos positivos de AV) — `WixToolset.Dtf` + `JsonSerializer`.
- **Tests automatizados** (unit/integration) en el dashboard; **Stripe billing** sprint.
- **Validar tema claro** visualmente (paleta oklch ajustada) + revisar contraste de badges en light mode.

---

## 6. Cómo correr la validación E2E (una vez aplicado FIX-1)
```powershell
# desde dashboard/ , con el server corriendo (localhost:3000)
node scratch/clean_db.js
node scratch/seed_e2e_tenants.js
pwsh scratch/e2e-auto-validation.ps1
# Esperado: todos los pasos PASS (C, D, E, F, G, H)
```
