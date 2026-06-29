# Enrollment + Secure Installer — Checklist de Implementación
**Proyecto:** AUDITORIA-ECA · **Objetivo:** Onboarding de agentes estilo ESET/AnyDesk con aislamiento multi-tenant.

> **Principio rector:** el instalador embebe un **enrollment token efímero y revocable**, NUNCA la API key operativa.
> El equipo cambia el token por una **credencial por-equipo** (bindeada al `server_guid`) en el primer arranque (*token exchange*).

Se implementa en 2 fases. **Fase 1 (motor de enroll) es prerrequisito de la Fase 2 (instalador).**

---

## FASE 1 — Motor de Enrolamiento (Opción 2)

### A. Base de Datos (Drizzle — `dashboard/src/db/schema.ts`)

- [ ] **Tabla `enrollment_tokens`** (token de bootstrap por tenant):
  - `id serial PK`
  - `tenant_id text` → FK `tenants.id` (`onDelete: cascade`)
  - `token_hash text` **unique** (SHA-256 del token; NUNCA guardar el raw)
  - `name text` (descriptivo, ej. "Despliegue GPO 2026")
  - `max_uses integer` nullable (null = ilimitado dentro del límite de licencia)
  - `used_count integer default 0`
  - `expires_at text` nullable (ISO 8601)
  - `revoked integer default 0`
  - `created_by text` (usuario admin)
  - `created_at text default now()`
  - Índice: `index(tenant_id)`

- [ ] **Binding por-equipo en `api_keys`** (reusar la tabla existente):
  - Añadir `device_id text` nullable (el `server_guid` del equipo)
  - Añadir `enrolled_via integer` nullable (id del enrollment_token usado)
  - Índice: `index(tenant_id, device_id)`
  - *(Así `validateApiKey` sigue funcionando sin cambios: resuelve `tenant_id` desde la key.)*

- [ ] Generar y aplicar migración: `npm run db:generate` + `npm run db:push`

### B. Endpoints del Servidor (Next API routes)

- [ ] **`POST /api/agent/enroll`** (público, rate-limited):
  - Body: `{ enroll_token, server_guid, hostname }`
  - 1. `sha256(enroll_token)` → buscar en `enrollment_tokens`
  - 2. Validar: existe · `revoked=0` · no expirado · `used_count < max_uses` · **tenant activo**
  - 3. Validar **límite de licencia** (`max_servers`): contar devices del tenant (reusar lógica de `verifyAndRegisterServer`)
  - 4. Generar API key por-equipo (`eca_dev_` + random) → `sha256` → insertar en `api_keys` con `{ tenant_id, device_id: server_guid, enrolled_via }`
  - 5. `used_count++`, registrar en `admin_audit_logs` (acción `agent_enroll`, ip, guid)
  - 6. Responder `{ api_key }` **una sola vez**
  - **Fail-secure**: ante cualquier duda → 4xx, no registrar.

- [ ] **`POST /api/settings/enrollment-tokens`** (admin/superadmin):
  - Crea token, devuelve el **raw una sola vez** (patrón igual a `/api/settings/keys`)
- [ ] **`GET /api/settings/enrollment-tokens`** — listar (sin el raw)
- [ ] **`DELETE /api/settings/enrollment-tokens?id=`** — revocar (`revoked=1`)

### C. Helpers en `db.ts`
- [ ] `createEnrollmentToken(tenantId, name, opts)`
- [ ] `validateAndConsumeEnrollToken(rawToken, serverGuid)` → emite la api_key por-equipo (transacción con `FOR UPDATE`/atomic `used_count++` para evitar carrera de cupo)
- [ ] `revokeEnrollmentToken(id, tenantId)`

### D. Agente C# (fuera de este repo)
- [ ] Leer `enroll_token` de: propiedad MSI / config / variable de entorno
- [ ] Generar y persistir `server_guid` (`Guid.NewGuid()`) en `%ProgramData%\ECA\agent-id`
- [ ] `POST /api/agent/enroll` → recibir `api_key`
- [ ] **Persistir la api_key cifrada con DPAPI** (`ProtectedData`, scope `LocalMachine`) en `%ProgramData%\ECA\cred`
- [ ] **ACL restrictiva** en el archivo (solo SYSTEM/Administrators)
- [ ] **Borrar el `enroll_token`** tras éxito (no conservar el bootstrap secret)
- [ ] Usar `x-api-key` para heartbeat/event + handshake WebSocket
- [ ] Si recibe `401` (key revocada) → re-enrolar o alertar

### E. Controles de Seguridad — Fase 1
- [ ] **Rate-limit** en `/api/agent/enroll` (reusar `rate-limiter`)
- [ ] **Token revocable + TTL + cupo de usos**
- [ ] **Credencial por-equipo bindeada** al `server_guid` (no reutilizable en otra máquina)
- [ ] **Auditoría** de cada enroll en `admin_audit_logs`
- [ ] **Scope server-side**: el tenant SIEMPRE se deriva del token (el cliente nunca lo declara)
- [ ] Respetar **`max_servers`** de la licencia en el enroll

---

## FASE 2 — Instalador Seguro (Opción 3)

### F. Empaquetado
- [ ] MSI (WiX/Advanced Installer) que instala el agente como **servicio**
- [ ] Soporte **instalación silenciosa**: `msiexec /qn ENROLL_TOKEN=...` (para GPO/Intune/RMM)
- [ ] El `server_guid` se genera **en cada máquina** al instalar (no en el MSI)

### G. Firma / Cadena de suministro
- [ ] **Code signing (Authenticode)** del instalador **y** de los binarios del agente
- [ ] Certificado **OV/EV**; **llave de firma en HSM** (no en laptop/CI plano)
- [ ] Pipeline de build **auditado**: el paso que embebe el token es server-side y registra qué tenant
- [ ] Publicar **hash/checksum** del instalador

### H. Distribución
- [ ] Descarga **autenticada**: solo el admin del tenant obtiene "su" token/instalador
- [ ] **URL firmada de corta duración** (no link público; el artefacto lleva un secreto)
- [ ] **TLS** en descarga + enroll + heartbeat + WebSocket (considerar **cert pinning** en el agente)

### I. Ciclo de vida
- [ ] Revocar **credencial por-equipo** (matar 1 máquina)
- [ ] Revocar **enroll token** (cortar nuevas altas) + **rotación**
- [ ] Desinstalación que **de-registra** el device
- [ ] **Auto-update firmado** del agente
- [ ] Expiración de equipos inactivos

### J. Privacidad / Cumplimiento (producto que captura pantallas)
- [ ] **Aviso/consentimiento** a empleados monitoreados (legal LATAM/Perú)
- [ ] **Cifrado en reposo** de capturas + **retención** (ya existe política)
- [ ] **Minimización** y control de acceso por rol
- [ ] Documentación de **allowlisting** para AV/EDR del cliente

---

## Checklist Transversal (prioridad)

| Control | Prioridad |
|---|---|
| Embeber **token** (no key runtime) + token exchange | 🔴 MUST |
| Credencial **por-equipo** + binding `server_guid` | 🔴 MUST |
| **Code signing** (instalador + binarios, llave en HSM) | 🔴 MUST |
| **TLS** + descarga autenticada (URL firmada) | 🔴 MUST |
| Enroll: rate-limit + license + audit + fail-secure | 🔴 MUST |
| Credencial local **DPAPI + ACLs** | 🔴 MUST |
| Token **TTL + cupo + revocable** | 🟠 SHOULD |
| Revocación granular (equipo / token) + rotación | 🟠 SHOULD |
| Auto-update firmado + anti-tamper | 🟠 SHOULD |
| Consentimiento + cifrado de capturas + retención | 🟠 SHOULD (legal) |
| Cert pinning + docs allowlisting AV | 🟢 NICE |

---

## Plan de Verificación

- [ ] **Happy path**: token válido → enroll → api_key emitida y persistida (DPAPI)
- [ ] Token **expirado/revocado** → rechazado
- [ ] **Sobre el límite** de licencia → rechazado
- [ ] **Binding**: la api_key de un device no funciona si se copia a otro `server_guid`
- [ ] **Cross-tenant**: token de A nunca emite credenciales de B
- [ ] **Rate-limit**: enroll masivo es frenado
- [ ] **Firma válida**: instalador y binarios pasan verificación Authenticode
- [ ] **Credencial en reposo** cifrada (DPAPI) + ACL correcta
- [ ] `tsc` + `next build` limpios

---

## Notas
- Fase 1 da el 80% del valor con el 20% del esfuerzo y habilita onboarding por GPO/RMM.
- Fase 2 es "producto" (pipeline MSI + firma): hazla cuando quieras la UX no-técnica estilo ESET.
- La Fase 2 **reusa** el token de la Fase 1 — no embebas nunca la key operativa en el MSI.

---

# CORRECCIONES DEL CODE REVIEW — Fase 1 (aplicar antes de la Fase 2)

> Estado: la base está sólida (atomicidad con `for('update')`, hashing, doble licencia, auditoría, fail-secure).
> Faltan 4 ajustes para que la seguridad quede realmente cubierta. Ordenados por prioridad.

## 🔴 C1 — El límite de licencia debe contar DEVICES, no `servers`
**Archivo:** `dashboard/src/lib/db.ts` → `validateAndConsumeEnrollToken`
**Problema:** el chequeo de cupo cuenta filas en `servers`, pero el enroll crea una `api_keys` (el server nace después en el primer heartbeat). Resultado: un tenant puede enrolar miles de devices sin tocar el límite → el gate es inefectivo.
**Fix:** contar credenciales de device (`api_keys` con `device_id` no nulo) en lugar de servers — para el límite per-tenant **y** el global.
```ts
import { isNotNull } from 'drizzle-orm';

// Per-tenant:
const countRow = await tx.select({ n: sql<number>`count(*)` })
  .from(schema.api_keys)
  .where(and(eq(schema.api_keys.tenant_id, token.tenant_id),
             isNotNull(schema.api_keys.device_id)));

// Global (licencia):
const globalCountRow = await tx.select({ n: sql<number>`count(*)` })
  .from(schema.api_keys)
  .where(isNotNull(schema.api_keys.device_id));
```
**Por qué:** alinea la unidad contada (device) con lo que el enroll realmente crea.

## 🔴 C2 — Enforzar el binding `device_id` al USAR la key (hoy se guarda pero no se valida)
**Archivos:** `dashboard/src/lib/api-middleware.ts` (`validateApiKey`), `dashboard/src/app/api/agent/heartbeat/route.ts`, `.../event/route.ts`, y `dashboard/server.ts` (middleware del socket).
**Problema:** una `eca_dev_` robada funciona para cualquier `server_id` del tenant. El binding está almacenado pero nunca comparado.
**Fix:** `validateApiKey` debe exponer el `device_id`, y cada caller debe exigir que coincida con el `server_id` reportado (cuando `device_id` esté seteado).
```ts
// api-middleware.ts — devolver también deviceId:
return { valid: true, tenantId: keyRow.tenant_id, deviceId: keyRow.device_id ?? null };

// heartbeat/event route — tras validar:
if (auth.deviceId && auth.deviceId !== body.server_id) {
  return unauthorizedResponse('La API key no corresponde a este equipo');
}

// server.ts (handshake socket del agente) — análogo:
if (keyRow.device_id && keyRow.device_id !== serverId) {
  return nextConn(new Error('Authentication error: API key no corresponde a este equipo'));
}
```
**Por qué:** cierra el "no se puede copiar a otra máquina" — el binding pasa de decorativo a efectivo.
**Nota de compatibilidad:** keys legadas (sin `device_id`, las `eca_key_` por-tenant) siguen funcionando porque la validación solo aplica cuando `device_id` no es nulo.

## 🟠 C3 — Re-enroll idempotente (no duplicar credenciales del mismo equipo)
**Archivo:** `dashboard/src/lib/db.ts` → `validateAndConsumeEnrollToken`
**Problema:** re-enrolar el mismo `server_guid` crea una segunda `api_keys` y vuelve a consumir cupo (`used_count++`).
**Fix:** antes de insertar, buscar `api_keys` por `(tenant_id, device_id)`:
- Si **existe** → **rotar** (`update key_hash`), **no** incrementar `used_count`.
- Si es **nuevo** → insertar + `used_count++` + auditar.
```ts
const existing = await tx.select().from(schema.api_keys)
  .where(and(eq(schema.api_keys.tenant_id, token.tenant_id),
             eq(schema.api_keys.device_id, serverGuid)));
if (existing[0]) {
  await tx.update(schema.api_keys).set({ key_hash: keyHash }).where(eq(schema.api_keys.id, existing[0].id));
  // NO incrementar used_count (mismo equipo)
} else {
  await tx.insert(schema.api_keys).values({ /* ... */ });
  await tx.update(schema.enrollment_tokens).set({ used_count: token.used_count + 1 }).where(eq(...));
}
```
**Por qué:** evita credenciales huérfanas y doble conteo de cupo en reinstalaciones/reintentos.

## 🟠 C4 — Rate-limit: parsear la primera IP de `x-forwarded-for`
**Archivo:** `dashboard/src/app/api/agent/enroll/route.ts`
**Problema:** se usa el header XFF completo (spoofeable: rotando el header se evade el bucket).
**Fix:**
```ts
const xff = request.headers.get('x-forwarded-for') || '';
const clientIp = xff.split(',')[0].trim() || 'unknown';
```
**Nota:** el tope real es el `max_uses` del token (el rate-limit es defensa en profundidad). El limiter es in-memory → con N nodos web el límite es por-nodo.

## 🟢 Menores (pulido)
- **Mensajes de error del enroll**: distinguen "no existe / revocado / expirado" → permite sondear validez de tokens. Considera un mensaje genérico para fallos de validación (mantén el detalle solo en logs server-side).
- **`createEnrollmentToken`**: validar `max_uses > 0` y que `expires_at` sea fecha válida (un `expires_at` malformado hace que el token **nunca** expire, silenciosamente).
- **Auditoría**: incluir en `details` el id de la `api_keys` emitida (trazabilidad credencial ↔ enroll).

## Verificación de las correcciones
- [ ] C1: enrolar más devices que `max_servers` → rechazado en el enroll (no solo en el heartbeat).
- [ ] C2: usar una `eca_dev_` con un `server_id` distinto al `device_id` → **401**.
- [ ] C2: keys legadas `eca_key_` (sin device_id) siguen funcionando.
- [ ] C3: re-enrolar el mismo `server_guid` → rota la key, **no** sube `used_count`.
- [ ] C4: XFF con lista/spoof → se usa solo la primera IP.
- [ ] `tsc --noEmit` + `next build` limpios.

---

# FASE 1-B — Cliente de Enrolamiento del Agente (C#)  ← SIGUIENTE PASO

> Estado: el backend de enroll (Fase 1) está completo y revisado. Falta la **mitad cliente**:
> que el agente se auto-enrole, persista su credencial de forma segura y la use.
> **Prerrequisito de la Fase 2** (el instalador solo entrega el token que este cliente canjea).

## Contrato del endpoint (ya implementado server-side)
```
POST {BaseUrl}/api/agent/enroll
Body:  { "enroll_token": "...", "server_guid": "...", "hostname": "..." }
200 →  { "status": "ok", "api_key": "eca_dev_xxxxxxxx" }     # se devuelve UNA vez
403 →  { "error": "..." }   # token inválido / expirado / revocado / límite
429 →  rate limit (reintentar con backoff)
```

## Configuración del agente
- `ApiBaseUrl` (ej. `https://panel.cliente.com`)
- `EnrollToken` (llega por: propiedad MSI / config / variable de entorno) — **bootstrap, efímero**
- **`ServerId` NO se configura** → se autogenera y persiste (ver abajo)

## Flujo de primer arranque (orden importa)
1. **Paths**: crear `%ProgramData%\ECA\` con **ACL restrictiva** (solo SYSTEM + Administrators).
2. **server_guid**: si existe `%ProgramData%\ECA\agent-id` → leerlo; si no → `Guid.NewGuid().ToString()` y **persistirlo**.
3. **Credencial**: si existe `%ProgramData%\ECA\cred` (DPAPI) → desencriptar y usar la `api_key`.
4. **Si NO hay credencial** → leer `EnrollToken` → `POST /api/agent/enroll { enroll_token, server_guid, hostname }`.
   - `hostname` = `Environment.MachineName`.
   - Al recibir `api_key`:
     - **Persistir cifrada** con `ProtectedData.Protect(..., DataProtectionScope.LocalMachine)` en `%ProgramData%\ECA\cred`.
     - **ACL restrictiva** al archivo.
     - **Descartar el EnrollToken** (borrarlo de config/registro/memoria — no conservar el bootstrap secret).
5. **Usar la `api_key`**: header `x-api-key` en heartbeat/event, y en el handshake del WebSocket (`?server_id=<guid>&api_key=<key>`).

## Manejo de errores / resiliencia
- [ ] Enroll con **reintentos + backoff** (manejar `429` y errores de red).
- [ ] **Idempotente**: si el agente ya tiene credencial válida, **no** re-enrola (reusa guid + cred). *(Coincide con C3 server-side: re-enrolar el mismo guid rota, no consume cupo.)*
- [ ] Si heartbeat devuelve **401** (key revocada) → intentar **re-enroll** si aún hay token disponible; si no, **loguear + alertar + detenerse** (no loop infinito).

## Buenas prácticas de seguridad (cliente)
- [ ] **DPAPI scope `LocalMachine`** (lo desencripta el servicio/SYSTEM; atado a la máquina; sobrevive reinicios).
- [ ] **ACLs** del directorio y archivos: solo SYSTEM/Administrators (no usuarios estándar).
- [ ] **No deshabilitar la validación TLS**; opcional **certificate pinning**.
- [ ] **Limpiar el token raw de memoria** tras usarlo (best-effort).
- [ ] Correr como **servicio de Windows** (LocalSystem o cuenta dedicada de bajo privilegio).
- [ ] **Nunca** guardar `api_key` ni `EnrollToken` en texto plano.

## Verificación (Fase 1-B)
- [ ] Primer arranque: enrola, recibe `eca_dev_`, persiste cifrada, **borra el token**.
- [ ] Segundo arranque: **reusa** guid + credencial (NO re-enrola; `used_count` no sube).
- [ ] El archivo de credencial está **cifrado (DPAPI)**, no en texto plano; ACL correcta.
- [ ] Token ausente/inválido → enroll falla **con gracia** (log claro, sin crash).
- [ ] 401 (key revocada) → re-enroll o alerta (sin loop).
- [ ] heartbeat/event/socket usan la `eca_dev_` y el binding `device_id === server_guid` pasa.

## Nota
- Como el agente vive **fuera de este repo**, el code review será de **lógica/seguridad** sobre el código que pegues (no `build` aquí).
- Una vez el agente se auto-enrola bien → recién tiene sentido la **Fase 2 (instalador MSI)** que embebe el `EnrollToken`.

---

# CORRECCIONES DEL CODE REVIEW — Fase 1-B (Agente C#)

> El cliente de enrolamiento quedó muy bien (GUID, DPAPI, ACLs, idempotencia, descarte de token,
> backoff/429, y manejo seguro del 401 = detener). Falta **1 fix** + menores opcionales.

## 🔴 F1B-1 — `DiscardEnrollToken` puede PERDER claves del `config.json`
**Archivo:** `agent-csharp/EcaMonitorAgent/Infrastructure/Providers/EnrollmentManager.cs`
**Función:** `DiscardEnrollToken` (reescribe el config tras canjear el token)
**Problema:** reconstruye el JSON copiando **solo** `String`, `Number(Int32)` y `Bool`. Cualquier otro tipo
(objeto anidado, **array**, `null`, `float`/`double`, `long` > Int32) se **descarta silenciosamente**.
Además `prop.Value.GetInt32()` **lanza excepción** si el número no cabe en Int32.
Con el config actual (`api_url` string + `heartbeat_interval` int) funciona por casualidad, pero es frágil:
agregar cualquier array/objeto/decimal al config → el primer arranque **borra** esa clave.

**Fix (preserva todo el JSON, sin importar el tipo):**
```csharp
using System.Text.Json.Nodes;

private void DiscardEnrollToken(string configPath, string rawConfig)
{
    try
    {
        var node = JsonNode.Parse(rawConfig)!.AsObject();
        node.Remove("enroll_token");
        node.Remove("api_key");
        File.WriteAllText(configPath,
            node.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
        _logger.LogInformation("Token de enrolamiento descartado y eliminado de {path}", configPath);
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "No se pudo limpiar el token del archivo config.json.");
    }
}
```
**Por qué:** `JsonNode` elimina solo las propiedades objetivo y re-serializa el resto intacto.
Más simple, robusto y sin pérdida de datos que reconstruir el diccionario a mano.

## 🟠 Menores (opcionales)
- **HttpClient en `PerformEnrollmentAsync`**: setear `Timeout` (ej. `TimeSpan.FromSeconds(30)`) para que no cuelgue; idealmente reusar un `HttpClient` estático en vez de `new` por llamada.
- **`PersistApiKey` traga excepciones**: si falla persistir, el agente re-enrola en cada arranque (idempotente server-side, pero conviene un log de nivel `Error`/`Critical` para detectarlo).
- **Path hardcodeado** `C:\ECA_Monitor\config.json` repetido en `Program.cs` y `MonitorWorker.cs` → extraer a una constante compartida (DRY).
- **Config en `C:\ECA_Monitor\` no está ACL-hardened** (solo `%ProgramData%\ECA`). El `enroll_token` vive ahí hasta el primer arranque que lo descarta → ventana de exposición (menor, el token es efímero/revocable).

## Verificación del fix
- [ ] Config con una clave extra de tipo array/objeto/decimal → tras el primer arranque **se conserva** (no se borra).
- [ ] `enroll_token` y `api_key` **sí** se eliminan del `config.json`.
- [ ] El agente arranca, enrola, persiste cred DPAPI y descarta el token sin corromper el config.
- [ ] `dotnet build` limpio (correr localmente).

## Después del fix
- Correr la suite de humo `dashboard/scratch/multitenant-smoke-test.ps1` ahora con el **agente real** enrolándose, para validar V2/V4/binding end-to-end.
- Recién entonces → **Fase 2 (instalador MSI)**.

---

# FASE 2 — PLAN DE IMPLEMENTACIÓN DETALLADO (Instalador MSI)

> Objetivo: entregar el agente como un **MSI firmado** que se instala como servicio, escribe el
> `enroll_token` en el config y permite despliegue masivo silencioso (GPO/RMM). UX estilo ESET.
> Reusa todos los controles de seguridad ya documentados en "Checklist Transversal" más arriba.

## ⚠️ A. PRERREQUISITO DE CÓDIGO (hacer ANTES del MSI)
El agente hoy corre como app de consola (`Host.CreateDefaultBuilder` + `RunAsync`). Para un servicio real:
- [ ] Agregar paquete **`Microsoft.Extensions.Hosting.WindowsServices`** y `.UseWindowsService()` al host (`Program.cs`).
- [ ] **Alinear la ruta del config**: hoy es `C:\ECA_Monitor\config.json` (hardcoded). El MSI debe escribir el config **exactamente ahí** (o cambiar ambos a una ruta consistente, idealmente bajo `%ProgramData%\ECA\`).
- [ ] Manejar arranque sin consola (logging a EventLog/archivo, no `Console`).
- [ ] Probar `sc start` / Service Control Manager localmente antes de empaquetar.

## B. Empaquetado MSI (WiX Toolset v4/v5)
- [ ] Proyecto WiX (`.wixproj` + `Package.wxs`).
- [ ] Instalar binarios del agente en `Program Files\ECA\Agent\`.
- [ ] Registrar **Windows Service** (`ServiceInstall` + `ServiceControl`): inicio automático, cuenta `LocalSystem` (necesaria para capturar pantalla de las sesiones), acciones de **recuperación** (reinicio ante fallo).
- [ ] Escribir `config.json` con `api_url` + `enroll_token` desde **propiedades MSI** (no embebido en el binario).
- [ ] Crear `%ProgramData%\ECA\` (las ACLs ya las endurece el agente en runtime).

## C. Instalación silenciosa (despliegue masivo)
- [ ] Propiedades MSI públicas: `ENROLL_TOKEN`, `API_URL`.
- [ ] Comando: `msiexec /i EcaAgent.msi /qn ENROLL_TOKEN=eca_enroll_xxx API_URL=https://panel.cliente.com/api`
- [ ] **Validar propiedad obligatoria**: si falta `ENROLL_TOKEN`, abortar la instalación con mensaje claro.
- [ ] Compatible con despliegue por **GPO / Intune / RMM**.

## D. Firma de código (Authenticode)
- [ ] Firmar **binarios del agente** (`.exe`/`.dll`) **y** el **`.msi`** con `signtool` (SHA-256 + timestamp).
- [ ] Certificado **OV/EV**; **llave en HSM** (no en CI plano).
- [ ] Verificar con `signtool verify /pa`.
- [ ] Publicar **hash/checksum** del MSI.

## E. Distribución autenticada (lado dashboard — in-repo, revisable)
> Recomendado (pragmático y seguro): **MSI genérico firmado** + el dashboard muestra el **comando de instalación por-tenant** con su token. Evita repackaging del MSI por cliente.
- [ ] Sección en Settings: "Descargar Agente" → botón que muestra el `msiexec ... ENROLL_TOKEN=<token del tenant>` listo para copiar.
- [ ] Servir el MSI vía **URL firmada de corta duración** (no link público).
- [ ] (Evolución opcional) generar un MSI/bootstrapper **por-tenant** con el token ya embebido (más UX, más pipeline).

## F. Auto-update firmado
- [ ] Endpoint de versión (ej. `GET /api/agent/version`) → el agente compara y descarga update **firmado**.
- [ ] Verificar firma antes de aplicar; reemplazo del binario + reinicio del servicio.
- [ ] (Alternativa simple v1) re-despliegue por RMM/GPO con el MSI nuevo.

## G. Desinstalación / de-registro (in-repo, revisable)
- [ ] Al desinstalar: detener servicio, eliminar binarios, limpiar `%ProgramData%\ECA\`.
- [ ] (Opcional) **de-registro**: el agente llama `POST /api/agent/deregister` con su `x-api-key` → el server marca/elimina esa `api_keys` (libera cupo de licencia). *Nuevo endpoint server-side.*
- [ ] Alternativa: el admin revoca el device desde la UI (ya tienes revocación de keys).

## H. Endurecimiento del servicio
- [ ] `LocalSystem` (trade-off documentado: necesario para captura de pantalla inter-sesión).
- [ ] Auto-restart + acciones de recuperación del SCM.
- [ ] Anti-tamper: el secreto vive cifrado (DPAPI) y el directorio con ACLs (ya implementado en Fase 1-B).

## Controles de seguridad (referencia)
Aplican TODOS los de la sección **"Checklist Transversal"** de arriba. Los 🔴 MUST críticos para Fase 2:
- [ ] El MSI embebe el **enroll_token** (efímero/revocable), **NUNCA** la `eca_dev_` operativa.
- [ ] **Code signing** de instalador + binarios (llave en HSM).
- [ ] **TLS** + descarga autenticada (URL firmada).

## Plan de Verificación (Fase 2)
- [ ] `msiexec /i ... /qn ENROLL_TOKEN=...` → instala, escribe config, registra el servicio, arranca.
- [ ] El servicio arranca como `LocalSystem` y el agente **se enrola solo** (reusa Fase 1-B).
- [ ] El config queda con el token, y el agente lo **descarta** en el primer arranque (ya validado).
- [ ] `signtool verify /pa` OK en MSI y binarios.
- [ ] Desinstalación limpia archivos + (si aplica) de-registra el device.
- [ ] Despliegue silencioso por GPO/RMM en >1 equipo → cada uno genera su GUID y su `eca_dev_`.

## Notas
- **A (Windows Service) es prerrequisito** — sin eso, el MSI instalaría algo que no corre como servicio.
- La parte **in-repo revisable** por mí: el endpoint de descarga/comando (E), el de-registro (G) y el de versión (F). El MSI/WiX en sí es review de configuración (no `build` del dashboard).

---

# CORRECCIONES DEL CODE REVIEW — Fase 2

> Lo bueno ya está: Windows Service, MSI embebe el **token efímero** (no la key), ruta del config
> alineada (`%ProgramData%\ECA\config.json`), deregister seguro, todo compila. Faltan 2 fixes + 1 menor.

## 🟠 F2 (el más importante) — La Custom Action escribe el config vía string de PowerShell
**Archivo:** `agent-csharp/EcaAgentSetup/Package.wxs` (custom action que escribe `config.json`)
**Problema:**
1. **Inyección**: `[API_URL]` (libre, lo da el cliente) se interpola dentro del comando PowerShell → un `'`, `;` o `$(...)` puede romper/inyectar.
2. **Exposición del token**: aparece en la **línea de comando de `powershell.exe`** → visible en el listado de procesos durante la instalación (aunque `Secure="yes"` lo oculta de los logs MSI).

**Fix recomendado (Managed Custom Action en C#):** reemplazar la CA de PowerShell por una CA gestionada con `WixToolset.Dtf.WindowsInstaller`, que lee las propiedades y escribe el JSON con `System.Text.Json` (sin interpolación, sin línea de comando):
```csharp
using WixToolset.Dtf.WindowsInstaller;
using System.Text.Json;
public class CustomActions {
  [CustomAction]
  public static ActionResult WriteAgentConfig(Session session) {
    // Deferred CA: leer de CustomActionData (las props se pasan como Secure)
    var data = session.CustomActionData;            // { "API_URL": "...", "ENROLL_TOKEN": "..." }
    var dir = System.IO.Path.Combine(
        System.Environment.GetFolderPath(System.Environment.SpecialFolder.CommonApplicationData), "ECA");
    System.IO.Directory.CreateDirectory(dir);
    var cfg = new { api_url = data["API_URL"], enroll_token = data["ENROLL_TOKEN"], heartbeat_interval = 30 };
    System.IO.File.WriteAllText(System.IO.Path.Combine(dir, "config.json"),
        JsonSerializer.Serialize(cfg, new JsonSerializerOptions { WriteIndented = true }));
    return ActionResult.Success;
  }
}
```
- Declarar la CA como **deferred** y pasar las props vía `CustomActionData` (`SetProperty` con `API_URL`/`ENROLL_TOKEN`).
**Fix interino (si se mantiene PowerShell):** pasar los valores por **variables de entorno** (no interpolar en `-Command`; leer `$env:ENROLL_TOKEN`) **y validar `API_URL`** (regex `^https://`).

## 🟠 F1 — `/api/agent/download` sin auth + MSI en `public/`
**Archivos:** `dashboard/src/app/api/agent/download/route.ts`, `dashboard/public/EcaAgent.msi`, `.gitignore`
**Problema:** el endpoint no valida sesión y, como el MSI está en `public/`, Next lo sirve igual en `/EcaAgent.msi` (doblemente público); además el `.msi` quedó **commiteado** al repo.
**Fix:**
1. **Gatear** la descarga tras sesión admin:
```ts
import { getAuthenticatedSession } from '@/lib/api-middleware';
export async function GET(request: NextRequest) {
  const session = getAuthenticatedSession(request);
  if (!session || (session.role !== 'admin' && session.role !== 'superadmin'))
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  // servir desde ruta NO pública
  const msiPath = path.join(process.cwd(), 'private', 'EcaAgent.msi');
  // ... (resto igual)
}
```
2. **Mover** el MSI fuera de `public/` (ej. `dashboard/private/EcaAgent.msi`) y actualizar el path del route.
3. **Gitignorear** el binario: agregar `dashboard/private/*.msi` (o donde lo dejes) al `.gitignore`. No commitear el `.msi`.
4. (Opcional) servir con stream en vez de `readFileSync` (evita cargar todo el MSI en memoria).

## 🟢 Menor — `deregister` sin auditoría
**Archivo:** `dashboard/src/app/api/agent/deregister/route.ts`
El enroll se audita pero el de-registro solo hace `console.log`. Agregar registro en `admin_audit_logs` (usa `auth.deviceId` que `validateApiKey` ya devuelve):
```ts
await db.insert(adminAuditLogsTable).values({
  tenant_id: auth.tenantId!, username: 'SYSTEM (Deregister)', action: 'agent_deregister',
  ip_address: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
  details: JSON.stringify({ device_id: auth.deviceId }),
});
```
(Opcional: limpiar también el `servers` row huérfano del device.)

## Code Signing (D) — proceso, no código
- [ ] Firmar binarios del agente **y** el `.msi` con `signtool sign /fd SHA256 /tr <timestamp> /td SHA256` (cert OV/EV, llave en HSM).
- [ ] `signtool verify /pa EcaAgent.msi` OK.
- (Sin firma, el MSI dará warnings de SmartScreen/AV.)

## Verificación de los fixes
- [ ] F2: instalar con un `API_URL` que contenga comillas/`;` → el config se escribe correcto, sin romper ni ejecutar nada.
- [ ] F2: el token **no** aparece en la línea de comando de procesos durante la instalación.
- [ ] F1: `/api/agent/download` sin sesión admin → **403**; el `.msi` ya no está en `public/` ni en el repo.
- [ ] Menor: un de-registro queda registrado en `admin_audit_logs`.
- [ ] `dotnet build` (agente + CA) y `next build` (dashboard) limpios.

---

# FIX FINAL FASE 2 — Robustez de `API_URL` (write-config.js)

> Lo crítico de F2 ya quedó (token por `CustomActionData`, no por línea de comando → sin exposición ni
> inyección de comandos). Falta cerrar **1 gap de robustez**: el JSON se arma por concatenación sin escapar,
> así que un `"` o `\` en `API_URL` rompe/inyecta el JSON. Severidad BAJA (lo provee el admin que instala),
> pero conviene blindarlo para no romper su propio config.

## El fix (1 línea)
**Archivo:** `agent-csharp/EcaAgentSetup/write-config.js` → función `WriteConfig`, bloque de validación de URL.

Reemplazar:
```js
// Validate URL starts with http:// or https://
if (apiUrl.indexOf("http://") !== 0 && apiUrl.indexOf("https://") !== 0) {
    return 3;
}
```
Por:
```js
// Validar URL http(s) y rechazar caracteres que romperían el JSON o el parsing por '|'
if (!/^https?:\/\/[^"\\|]+$/.test(apiUrl)) {
    return 3; // ERROR_INSTALL_FAILURE
}
```

## Por qué este regex
- `^https?:\/\/` → exige esquema http/https (mantiene la validación que ya tenías).
- `[^"\\|]+$` → **prohíbe** comillas dobles `"`, backslash `\` y pipe `|`:
  - `"` y `\` → evitan romper/inyectar el JSON construido por concatenación.
  - `|` → evita colisión con el delimitador de `CustomActionData` (`commonAppData|temp|apiUrl|token`).

## Qué más tener en cuenta
- **Rebuild del MSI**: tras editar `write-config.js`, **reconstruir** el instalador (`build-msi.ps1`) para que el `.js` actualizado quede embebido en el MSI. El cambio NO aplica hasta reempaquetar.
- **El token (`eca_enroll_...`) es hex** → no necesita validación extra (charset seguro). El riesgo estaba solo en `API_URL` (libre).
- **No cambiar el orden ni el separador** de `CustomActionData` en `Package.wxs` (`[CommonAppDataFolder]|[TempFolder]|[API_URL]|[ENROLL_TOKEN]`) — el `.js` hace `split("|")` por índice.
- **Gitignore de artefactos**: confirmar que `agent-csharp/.gitignore` ignora `*.msi`, `*.wixpdb`, `*.cab`, `bin/`, `obj/`, `publish/` (que ya tocaste) — para no commitear binarios pesados.
- **No** introducir `JSON.stringify`: el motor de scripts de MSI (JScript clásico) **no** trae `JSON` nativo; por eso el regir-y-concatenar es el camino pragmático aquí.

## Verificación del fix
- [ ] Instalar con `API_URL="https://x.com\",\"admin\":true"` (o con comillas/`|`) → la instalación **falla con gracia** (return 3), no escribe un config corrupto.
- [ ] Instalar con `API_URL=https://panel.cliente.com/api` válido → config correcto, agente enrola.
- [ ] MSI reconstruido con `build-msi.ps1` (el `.js` nuevo embebido).
- [ ] (Opcional, evolución) migrar la CA de JScript a **Managed CA C#** (`WixToolset.Dtf`) para usar `JsonSerializer` y mayor robustez/anti-AV.
