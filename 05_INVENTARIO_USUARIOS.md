# Inventario de Usuarios y Distribución por Servidor

## Resumen

| Servidor | Hostname | IP LAN | IP Tailscale | Usuarios |
|----------|----------|--------|--------------|----------|
| Servidor 1 (Principal) | DESKTOP-E4F6THB | 192.168.18.4 | 100.108.248.45 | 7 |
| Servidor 2 | DESKTOP-TR7OGR1 | 192.168.18.31 | 100.112.15.36 | 3 |
| Servidor 3 | DESKTOP-LKSNKOL | 192.168.18.136 | 100.109.28.98 | 3 |
| **TOTAL** | | | | **13** |

---

## Servidor 1 — DESKTOP-E4F6THB (Intel i5-10400 / 32 GB RAM)

| N° | Usuario | Nombre Completo | Contraseña Inicial |
|----|---------|-----------------|-------------------|
| 1 | CONT | Winner Huamantalla | Cont@2026Wh |
| 2 | CONT1 | Melany Roldan Berrocal | Cont1@2026Mr |
| 3 | SIST | Gianmarco Hugo Villalva Castillo | Sist@2026Gv |
| 4 | SIST1 | Ruly Segura Martinez | Sist1@2026Rs |
| 5 | SIST3 | Miluska Alvarez Sandoval | Sist3@2026Ma |
| 6 | SIST4 | Alexander Alania | Sist4@2026Aa |
| 7 | SIST11 | Esther Enríquez Arango | Sist11@2026Ea |

**Conexión:**
- LAN: `mstsc /v:192.168.18.4`
- Tailscale: `mstsc /v:100.108.248.45`

---

## Servidor 2 — DESKTOP-TR7OGR1 (Intel i5-6500T / 16 GB RAM)

| N° | Usuario | Nombre Completo | Contraseña Inicial |
|----|---------|-----------------|-------------------|
| 1 | SIST9 | Edith Cerrón Alvarez | Sist9@2026Ea |
| 2 | SIST2 | María Melendez Contreras | Sist2@2026Mm |
| 3 | SIST10 | Fernanda Rojas | Sist10@2026Fr |

**Conexión:**
- LAN: `mstsc /v:192.168.18.31`
- Tailscale: `mstsc /v:100.112.15.36`

**Nota:** El usuario SIST8 (anteriormente Emerson Chaupin Huari, renombrado a Esther Enríquez Arango) fue eliminado de este servidor. Esther fue migrada al Servidor 1 como SIST11.

---

## Servidor 3 — DESKTOP-LKSNKOL (Intel i5-4590S / 16 GB RAM)

| N° | Usuario | Nombre Completo | Contraseña Inicial |
|----|---------|-----------------|-------------------|
| 1 | SIST5 | Evelyn Acero Castillo | Sist5@2026Ea |
| 2 | SIST6 | Adrian Antonio Zavaleta Ticona | Sist6@2026Az |
| 3 | SIST7 | Mallury Carrasco Segundo | Sist7@2026Mc |

**Conexión:**
- LAN: `mstsc /v:192.168.18.136`
- Tailscale: `mstsc /v:100.109.28.98`

**Nota:** El usuario SIST4 (Alexander Alania) fue eliminado de este servidor y migrado primero al Servidor 1.

---

## Historial de Cambios de Usuarios

| Fecha Aprox. | Acción | Usuario | Detalle |
|-------------|--------|---------|---------|
| Enero 2026 | Creación inicial | CONT, CONT1, SIST, SIST1, SIST3, SIST4, SIST5, SIST6, SIST7, SIST8 | 10 usuarios creados en Servidor 1 |
| Enero 2026 | Creación | SIST9, SIST2 | Creados para completar la distribución (12 usuarios) |
| Enero 2026 | Distribución | SIST8, SIST9, SIST2 | Movidos al Servidor 2 (TR7OGR1) |
| Enero 2026 | Distribución | SIST4, SIST5, SIST6, SIST7 | Movidos al Servidor 3 (LKSNKOL) |
| Febrero 2026 | Movimiento | SIST4 | Movido de Servidor 3 → Servidor 1 (por falta de accesos) |
| Febrero 2026 | Eliminación + Creación | SIST4 | Eliminado de Servidor 3, creado también en Servidor 2 (conflictos detectados) |
| Febrero 2026 | Creación | SIST10 (Fernanda Rojas) | Nuevo usuario creado en Servidor 2 |
| Febrero 2026 | Renombramiento | SIST8 | Nombre cambiado de Emerson Chaupin Huari → Esther Enríquez Arango (Servidor 2) |
| Febrero 2026 | Migración | SIST11 (Esther Enríquez Arango) | Creada como nuevo usuario en Servidor 1 |
| Febrero 2026 | Eliminación | SIST8 | Eliminada del Servidor 2 (Esther ahora opera como SIST11 en Servidor 1) |

---

## Usuarios Eliminados / Inactivos

| Usuario | Nombre Original | Servidor | Estado | Motivo |
|---------|----------------|----------|--------|--------|
| SIST8 | Emerson Chaupin Huari → Esther Enríquez Arango | Servidor 2 (TR7OGR1) | Eliminado | Migrada a Servidor 1 como SIST11 |
| SIST4 | Alexander Alania | Servidor 3 (LKSNKOL) | Eliminado | Movido a Servidor 1 |
