# Plan de Pruebas End-to-End — Enrolamiento + Multi-Tenant (Auditoría ECA)
**Objetivo:** validar el círculo completo: token → MSI → servicio → auto-enroll → credencial DPAPI →
binding → aislamiento multi-tenant → de-registro. Marcar PASS/FAIL en cada paso.

> Requisitos previos:
> - Dashboard corriendo (`localhost:3000` o prod) con la DB **migrada** (incluye `enrollment_tokens`, `device_id`).
> - **Licencia válida** activa (si no, el enroll se rechaza por diseño).
> - **2 tenants reales** (NO `default`), cada uno con su usuario admin. *(El bug clásico es que todo caiga en `default` y "parezca" aislado.)*
> - 1 máquina/VM Windows de prueba para instalar el MSI.
> - El MSI firmado (o sin firmar para test interno; sin firma habrá warning de SmartScreen).

---

## FASE A — Preparación (Tenant A)
- [ ] **A1** Login como admin del **Tenant A** → confirmar que el JWT lleva su `tenantId` (inspeccionar cookie `auth-token` decodificada).
- [ ] **A2** Settings → generar **enrollment token** → copiar el `eca_enroll_...` (se muestra **una sola vez**).
- [ ] **A3** Anotar el `max_servers` del Tenant A (para la prueba de límite, Fase F).

## FASE B — Instalación del MSI
- [ ] **B1** Instalación silenciosa:
  ```powershell
  msiexec /i EcaAgent.msi /qn ENROLL_TOKEN=eca_enroll_xxx API_URL=https://TU_HOST/api
  ```
- [ ] **B2** Servicio instalado y corriendo:
  ```powershell
  sc query EcaMonitorAgent      # STATE debe ser RUNNING
  ```
- [ ] **B3** GUID generado: existe `%ProgramData%\ECA\agent-id` con un GUID válido.
- [ ] **B4** Tras el primer arranque:
  - `%ProgramData%\ECA\config.json` **ya NO tiene** `enroll_token` (descartado).
  - Existe `%ProgramData%\ECA\cred` y **NO está en texto plano** (es DPAPI: bytes binarios, no se ve el `eca_dev_`).
- [ ] **B5** ACLs correctas en `%ProgramData%\ECA`:
  ```powershell
  icacls "%ProgramData%\ECA"     # solo SYSTEM y Administrators con Full
  ```
- [ ] **B6** (Robustez F2) Reinstalar pasando `API_URL=https://x.com","admin":true` → la instalación **falla con gracia** (no escribe config corrupto).

## FASE C — Enrolamiento y aparición en el dashboard
- [ ] **C1** En el dashboard del **Tenant A**, aparece el nuevo servidor (con `hostname`/`name`).
- [ ] **C2** En DB, la `api_keys` del device:
  ```sql
  SELECT id, tenant_id, device_id, enrolled_via, name
  FROM api_keys WHERE device_id = '<GUID_del_agent-id>';
  -- device_id = GUID, tenant_id = Tenant A, enrolled_via = id del token
  ```
- [ ] **C3** El token consumió cupo:
  ```sql
  SELECT name, used_count, max_uses FROM enrollment_tokens WHERE token_hash = sha256('<rawToken>');
  -- used_count incrementado en 1
  ```
- [ ] **C4** Auditoría:
  ```sql
  SELECT * FROM admin_audit_logs WHERE action = 'agent_enroll' ORDER BY id DESC LIMIT 1;
  ```

## FASE D — Idempotencia (reinicio del servicio)
- [ ] **D1** Reiniciar:
  ```powershell
  sc stop EcaMonitorAgent; sc start EcaMonitorAgent
  ```
- [ ] **D2** **NO** re-enrola: `used_count` del token **igual** que en C3; **no** se crea otra `api_keys`.
- [ ] **D3** Reusa `agent-id` + `cred` (mismos GUID y key); los heartbeats siguen (el server queda `online`).

## FASE E — Binding enforcement (seguridad clave)
> Necesitas la `eca_dev_` en claro: NO se puede leer del DPAPI fácil. Alternativa: usa la **suite de humo** que
> ya emite con keys conocidas, o genera una key de prueba. Si tienes la `eca_dev_`:
- [ ] **E1** Heartbeat con la `eca_dev_` pero un `server_id` **distinto** al `device_id` → **401** (binding):
  ```powershell
  $h = @{ "x-api-key"="eca_dev_xxx"; "Content-Type"="application/json" }
  $b = @{ server_id="otro-guid-distinto"; metrics=@{cpu_percent=10;ram_used_mb=1000;ram_total_mb=8000;disk_percent=20} } | ConvertTo-Json
  Invoke-RestMethod -Uri "https://TU_HOST/api/agent/heartbeat" -Method Post -Headers $h -Body $b
  # Espera 401
  ```
- [ ] **E2** Mismo heartbeat con el `server_id` correcto (el GUID del device) → **200**.
- [ ] **E3** (Compat) Una `eca_key_` legada (sin `device_id`, de Settings → "Claves de API") sigue funcionando con cualquier `server_id` de su tenant.

## FASE F — Aislamiento multi-tenant
- [ ] **F1** Repetir A+B con el **Tenant B** (su token, su agente/VM, su `server_id`).
- [ ] **F2** Correr la suite de humo (rellenar las 2 keys):
  ```powershell
  pwsh dashboard/scratch/multitenant-smoke-test.ps1
  ```
  - **V4** (cross-tenant) y **V6** (lectura) deben dar **PASS**.
- [ ] **F3** Dashboard del Tenant A **NO** ve el server del Tenant B (ni en servers, sesiones, logs, alertas).
- [ ] **F4** Límite de licencia: enrolar más devices que `max_servers` del tenant → el que excede es **rechazado en el enroll** (no solo en el heartbeat).
- [ ] **F5** (Realtime, opcional) 2 dashboards abiertos: una alerta/captura del Tenant A **no** llega al Tenant B (rooms `tenant:<id>`).

## FASE G — De-registro / desinstalación
- [ ] **G1** Desinstalar:
  ```powershell
  msiexec /x EcaAgent.msi /qn
  ```
- [ ] **G2** Servicio eliminado (`sc query EcaMonitorAgent` → no existe) y `%ProgramData%\ECA` limpio (CleanupConfig).
- [ ] **G3** El `/api/agent/deregister` (si lo cableas en uninstall) borra la `eca_dev_` + audita; si no, revocar la key desde la UI.

## FASE H — Seguridad transversal
- [ ] **H1** `/api/agent/download` **sin** sesión admin → **403**; con admin → descarga el MSI.
- [ ] **H2** El `.msi` **no** está en `public/` ni commiteado al repo.
- [ ] **H3** (Avanzado) Durante el `msiexec`, abrir Process Explorer/Monitor → el `enroll_token` **NO** aparece en la línea de comando de ningún proceso (fix F2).
- [ ] **H4** El `enroll_token` se descartó del `config.json` tras el primer arranque (ya en B4).

---

## Criterios de aceptación (must-pass)
1. 🔴 **B4/H4** — token descartado del config; **H3** — token nunca en línea de comando.
2. 🔴 **E1** — binding: `eca_dev_` no sirve con otro `server_id` (401).
3. 🔴 **F3/F4/V4/V6** — aislamiento total entre tenants + límite de licencia en el enroll.
4. 🔴 **D2** — idempotencia: reinicio no re-enrola ni consume cupo.
5. 🟠 **B5** — credencial cifrada (DPAPI) + ACLs restrictivas.

## Notas para quien ejecute (Gemini / tú)
- Si **V4 o F3 fallan** → revisar que los 2 tenants sean **distintos** (no ambos `default`) en `api_keys.tenant_id` y `servers.tenant_id`.
- Si el agente **no levanta** → revisar que el MSI escribió el config en `%ProgramData%\ECA\config.json` (misma ruta que `AgentConfig.DefaultConfigPath`).
- Si el enroll devuelve **403 "límite"** inesperado → revisar `max_servers` del tenant y la licencia global.
- Si el enroll devuelve **403 "tenant inactivo"** → el tenant debe tener `status = 'active'`.
