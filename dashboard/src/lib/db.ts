import { Pool } from 'pg';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql, eq, and, desc, lt, gte, lte, inArray, isNotNull } from 'drizzle-orm';
import * as schema from '../db/schema';
import { 
  servers as serversTable, 
  sessions as sessionsTable, 
  session_logs as logsTable, 
  server_metrics as metricsTable, 
  alerts as alertsTable 
} from '../db/schema';

import type {
  Server,
  Session,
  SessionLog,
  ServerMetrics,
  Alert,
  ServerWithMetrics,
  DashboardStats,
} from '../types';

// ═══════════════════════════════════════════════════════
// PostgreSQL Database Connection & Drizzle ORM Instance
// ═══════════════════════════════════════════════════════

let pool: Pool | null = null;
let drizzleDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDbPool(): Pool {
  if (pool) return pool;
  
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL no está definida. Configúrala en el archivo .env.');
  }

  pool = new Pool({
    connectionString: DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  return pool;
}

export function getDrizzleDb() {
  if (drizzleDb) return drizzleDb;
  const dbPool = getDbPool();
  drizzleDb = drizzle(dbPool, { schema });
  return drizzleDb;
}

// ═══════════════════════════════════════════════════════
// Database Seeding (System Core Tenants & Superadmin)
// ═══════════════════════════════════════════════════════

let seeded = false;
export async function seedDatabase(): Promise<void> {
  if (seeded) return;
  const db = getDrizzleDb();
  try {
    // 1. Ensure core system tenants exist
    await db.insert(schema.tenants)
      .values([
        { id: 'default', name: 'Default Tenant', status: 'active', plan: 'basic', max_servers: 5 },
        { id: 'system', name: 'SaaS System Operator', status: 'active', plan: 'custom', max_servers: 999 }
      ])
      .onConflictDoNothing()
      .execute();
      
    // 2. Ensure default settings exist for core tenants
    await db.insert(schema.tenant_settings)
      .values([
        { tenant_id: 'system', alert_emails: '' },
        { tenant_id: 'default', alert_emails: '' }
      ])
      .onConflictDoNothing()
      .execute();

    // 3. Ensure default superadmin user exists
    const superUsers = await db.select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(and(
        eq(schema.users.tenant_id, 'system'),
        eq(schema.users.role, 'superadmin')
      ));

    const count = Number(superUsers[0]?.count || 0);
    if (count === 0) {
      const tempPassword = process.env.SUPERADMIN_PASSWORD || crypto.randomBytes(12).toString('hex');
      const hash = bcryptjs.hashSync(tempPassword, 10);
      await db.insert(schema.users)
        .values({
          tenant_id: 'system',
          username: 'superadmin',
          password_hash: hash,
          full_name: 'Super Administrador',
          role: 'superadmin',
          password_change_required: 1,
        })
        .execute();
      console.log('════════════════════════════════════════');
      console.log('       SUPERADMIN CREADO EXITOSAMENTE   ');
      console.log(' Usuario: superadmin');
      console.log(` Contraseña temporal: ${tempPassword}`);
      console.log(' (Cámbiala en el primer inicio de sesión)');
      console.log('════════════════════════════════════════');
    }

    // Ensure installation record is generated on database seed
    await ensureInstallation();

    seeded = true;
  } catch (err) {
    console.error("Error seeding database:", err);
  }
}

export async function ensureInstallation(): Promise<string> {
  const db = getDrizzleDb();
  try {
    const rows = await db.select().from(schema.installation).where(eq(schema.installation.id, 1));
    if (rows[0]) return rows[0].install_id;
    const installId = crypto.randomUUID();
    await db.insert(schema.installation).values({ id: 1, install_id: installId }).onConflictDoNothing();
    const again = await db.select().from(schema.installation).where(eq(schema.installation.id, 1));
    return again[0].install_id;
  } catch (err) {
    console.error("Error ensuring installation registration:", err);
    return "fallback-install-uuid";
  }
}

// ═══════════════════════════════════════════════════════
// Drizzle ORM Query Helpers (Asynchronous)
// ═══════════════════════════════════════════════════════

// ─── Tenants ───

export async function getTenantByServerId(serverId: string): Promise<string> {
  const db = getDrizzleDb();
  const server = await db.select({ tenant_id: serversTable.tenant_id })
    .from(serversTable)
    .where(eq(serversTable.id, serverId));
  return server[0]?.tenant_id ?? 'default';
}

// ─── Servers ───

export async function getAllServers(tenantId: string): Promise<ServerWithMetrics[]> {
  const db = getDrizzleDb();
  
  // Get all servers for this tenant
  const allServers = await db.select()
    .from(serversTable)
    .where(eq(serversTable.tenant_id, tenantId))
    .orderBy(serversTable.id);

  const serverPromises = allServers.map(async (server) => {
    // Get latest metrics
    const metricsList = await db.select()
      .from(metricsTable)
      .where(and(
        eq(metricsTable.server_id, server.id),
        eq(metricsTable.tenant_id, tenantId)
      ))
      .orderBy(desc(metricsTable.timestamp))
      .limit(1);

    const metrics = metricsList[0] || null;

    // Get active sessions count
    const activeSessions = await db.select()
      .from(sessionsTable)
      .where(and(
        eq(sessionsTable.server_id, server.id),
        eq(sessionsTable.tenant_id, tenantId),
        eq(sessionsTable.state, 'Active')
      ));

    return {
      ...server,
      status: server.status as 'online' | 'offline',
      created_at: server.created_at ?? '',
      metrics: metrics ? {
        ...metrics,
        cpu_percent: metrics.cpu_percent ?? 0,
        ram_used_mb: metrics.ram_used_mb ?? 0,
        ram_total_mb: metrics.ram_total_mb ?? 0,
        disk_percent: metrics.disk_percent ?? 0,
        active_sessions: metrics.active_sessions ?? 0,
        timestamp: metrics.timestamp ?? '',
      } : null,
      active_sessions_count: activeSessions.length,
    };
  });

  return Promise.all(serverPromises);
}

export async function getServerById(id: string, tenantId: string): Promise<ServerWithMetrics | null> {
  const db = getDrizzleDb();
  
  const serversList = await db.select()
    .from(serversTable)
    .where(and(
      eq(serversTable.id, id),
      eq(serversTable.tenant_id, tenantId)
    ));

  const server = serversList[0];
  if (!server) return null;

  const metricsList = await db.select()
    .from(metricsTable)
    .where(and(
      eq(metricsTable.server_id, id),
      eq(metricsTable.tenant_id, tenantId)
    ))
    .orderBy(desc(metricsTable.timestamp))
    .limit(1);

  const metrics = metricsList[0] || null;

  const sessionsList = await db.select()
    .from(sessionsTable)
    .where(and(
      eq(sessionsTable.server_id, id),
      eq(sessionsTable.tenant_id, tenantId)
    ))
    .orderBy(sessionsTable.username);

  return {
    ...server,
    status: server.status as 'online' | 'offline',
    created_at: server.created_at ?? '',
    metrics: metrics ? {
      ...metrics,
      cpu_percent: metrics.cpu_percent ?? 0,
      ram_used_mb: metrics.ram_used_mb ?? 0,
      ram_total_mb: metrics.ram_total_mb ?? 0,
      disk_percent: metrics.disk_percent ?? 0,
      active_sessions: metrics.active_sessions ?? 0,
      timestamp: metrics.timestamp ?? '',
    } : null,
    sessions: sessionsList.map((s) => ({
      ...s,
      session_id: s.session_id ?? 0,
      updated_at: s.updated_at ?? '',
      state: s.state as 'Active' | 'Idle' | 'Disconnected',
    })),
    active_sessions_count: sessionsList.filter((s) => s.state === 'Active').length,
  };
}

// ─── Sessions ───

export async function getAllActiveSessions(tenantId: string): Promise<Session[]> {
  const db = getDrizzleDb();
  
  const results = await db.select({
    id: sessionsTable.id,
    server_id: sessionsTable.server_id,
    username: sessionsTable.username,
    session_id: sessionsTable.session_id,
    state: sessionsTable.state,
    logon_time: sessionsTable.logon_time,
    source_ip: sessionsTable.source_ip,
    idle_time: sessionsTable.idle_time,
    full_name: sessionsTable.full_name,
    updated_at: sessionsTable.updated_at,
    server_status: serversTable.status,
  })
  .from(sessionsTable)
  .leftJoin(serversTable, eq(sessionsTable.server_id, serversTable.id))
  .where(eq(sessionsTable.tenant_id, tenantId))
  .orderBy(sessionsTable.server_id, sessionsTable.username);

  return results.map((s) => ({
    ...s,
    session_id: s.session_id ?? 0,
    updated_at: s.updated_at ?? '',
    state: s.state as 'Active' | 'Idle' | 'Disconnected',
    server_status: s.server_status as 'online' | 'offline' | undefined,
  })) as Session[];
}

export async function upsertSessions(serverId: string, sessionsList: Partial<Session>[]): Promise<void> {
  const db = getDrizzleDb();
  const tenantId = await getTenantByServerId(serverId);

  // Get current active sessions for this server and tenant
  const allCurrent = await db.select({
    session_id: sessionsTable.session_id,
    username: sessionsTable.username,
  })
  .from(sessionsTable)
  .where(and(
    eq(sessionsTable.server_id, serverId),
    eq(sessionsTable.tenant_id, tenantId)
  ));
  
  const currentKeys = allCurrent.map((r) => `${r.session_id}|${r.username}`);
  
  await db.transaction(async (tx) => {
    if (sessionsList.length > 0) {
      const incomingKeys = sessionsList.map((s) => `${s.session_id}|${s.username}`);
      const toDelete = allCurrent.filter((r) => !incomingKeys.includes(`${r.session_id}|${r.username}`));
      const newSessions = sessionsList.filter((s) => !currentKeys.includes(`${s.session_id}|${s.username}`));

      // Log and delete stale sessions
      for (const row of toDelete) {
        await tx.insert(logsTable).values({
          tenant_id: tenantId,
          server_id: serverId,
          username: row.username,
          event_type: 'disconnect',
          session_id: row.session_id,
          source_ip: null,
          timestamp: sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`,
          details: 'Desconexión automática inferida por Heartbeat',
        });

        await tx.delete(sessionsTable)
          .where(and(
            eq(sessionsTable.server_id, serverId),
            eq(sessionsTable.tenant_id, tenantId),
            eq(sessionsTable.session_id, row.session_id!),
            eq(sessionsTable.username, row.username)
          ));
      }

      // Log new connects
      for (const s of newSessions) {
        await tx.insert(logsTable).values({
          tenant_id: tenantId,
          server_id: serverId,
          username: s.username!,
          event_type: 'connect',
          session_id: s.session_id!,
          source_ip: s.source_ip || null,
          timestamp: sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`,
          details: 'Conexión automática inferida por Heartbeat',
        });
      }
    } else {
      // Remove all sessions and log disconnects
      for (const row of allCurrent) {
        await tx.insert(logsTable).values({
          tenant_id: tenantId,
          server_id: serverId,
          username: row.username,
          event_type: 'disconnect',
          session_id: row.session_id,
          source_ip: null,
          timestamp: sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`,
          details: 'Desconexión masiva (Servidor vacío)',
        });
      }
      await tx.delete(sessionsTable).where(and(
        eq(sessionsTable.server_id, serverId),
        eq(sessionsTable.tenant_id, tenantId)
      ));
    }

    // Upsert active sessions
    for (const session of sessionsList) {
      await tx.insert(sessionsTable)
        .values({
          tenant_id: tenantId,
          server_id: serverId,
          username: session.username!,
          session_id: session.session_id!,
          state: session.state || 'Active',
          logon_time: session.logon_time || null,
          source_ip: session.source_ip || null,
          idle_time: session.idle_time || null,
          full_name: session.full_name || null,
          updated_at: sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`,
        })
        .onConflictDoUpdate({
          target: [sessionsTable.server_id, sessionsTable.username, sessionsTable.session_id],
          set: {
            state: session.state || 'Active',
            idle_time: session.idle_time || null,
            source_ip: session.source_ip || null,
            full_name: session.full_name || null,
            updated_at: sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`,
          },
        });
    }
  });
}

// ─── Session Logs ───

export async function insertSessionLog(log: Omit<SessionLog, 'id' | 'created_at'>): Promise<void> {
  const db = getDrizzleDb();
  const tenantId = await getTenantByServerId(log.server_id);
  
  await db.insert(logsTable).values({
    tenant_id: tenantId,
    server_id: log.server_id,
    username: log.username,
    event_type: log.event_type,
    session_id: log.session_id,
    source_ip: log.source_ip,
    timestamp: log.timestamp,
    details: log.details,
  });
}

export async function getSessionLogs(
  filters: {
    from?: string;
    to?: string;
    username?: string;
    server_id?: string;
    limit?: number;
    offset?: number;
  },
  tenantId: string
): Promise<{ logs: SessionLog[]; total: number }> {
  const db = getDrizzleDb();
  const conditions = [eq(logsTable.tenant_id, tenantId)];

  if (filters.from) {
    conditions.push(gte(logsTable.timestamp, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(logsTable.timestamp, filters.to));
  }
  if (filters.username) {
    conditions.push(eq(logsTable.username, filters.username));
  }
  if (filters.server_id) {
    conditions.push(eq(logsTable.server_id, filters.server_id));
  }

  const whereClause = and(...conditions);
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  // Get total count
  const countResult = await db.select({
    count: sql<number>`COUNT(*)`
  })
  .from(logsTable)
  .where(whereClause);

  const total = Number(countResult[0]?.count ?? 0);

  // Get paginated results
  const logsList = await db.select()
    .from(logsTable)
    .where(whereClause)
    .orderBy(desc(logsTable.timestamp))
    .limit(limit)
    .offset(offset);

  return { 
    logs: logsList.map((l) => ({
      ...l,
      event_type: l.event_type as 'connect' | 'disconnect' | 'idle' | 'active',
    })) as SessionLog[], 
    total,
  };
}

// ─── Server Metrics ───

export async function insertServerMetrics(
  serverId: string,
  metrics: { cpu_percent: number; ram_used_mb: number; ram_total_mb: number; disk_percent: number },
  activeSessionsCount: number
): Promise<void> {
  const db = getDrizzleDb();
  const tenantId = await getTenantByServerId(serverId);
  
  await db.transaction(async (tx) => {
    await tx.insert(metricsTable).values({
      tenant_id: tenantId,
      server_id: serverId,
      cpu_percent: metrics.cpu_percent,
      ram_used_mb: metrics.ram_used_mb,
      ram_total_mb: metrics.ram_total_mb,
      disk_percent: metrics.disk_percent,
      active_sessions: activeSessionsCount,
    });

    await tx.update(serversTable)
      .set({
        status: 'online',
        last_seen: sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`,
      })
      .where(and(
        eq(serversTable.id, serverId),
        eq(serversTable.tenant_id, tenantId)
      ));
  });
}

export async function getServerMetricsHistory(
  serverId: string,
  hours: number = 1
): Promise<ServerMetrics[]> {
  const db = getDrizzleDb();
  const tenantId = await getTenantByServerId(serverId);
  
  const list = await db.select()
    .from(metricsTable)
    .where(and(
      eq(metricsTable.server_id, serverId),
      eq(metricsTable.tenant_id, tenantId),
      gte(metricsTable.timestamp, sql`TO_CHAR(NOW() - (${hours} * INTERVAL '1 hour'), 'YYYY-MM-DD HH24:MI:SS')`)
    ))
    .orderBy(metricsTable.timestamp);

  return list.map(metrics => ({
    ...metrics,
    cpu_percent: metrics.cpu_percent ?? 0,
    ram_used_mb: metrics.ram_used_mb ?? 0,
    ram_total_mb: metrics.ram_total_mb ?? 0,
    disk_percent: metrics.disk_percent ?? 0,
    active_sessions: metrics.active_sessions ?? 0,
    timestamp: metrics.timestamp ?? '',
  })) as ServerMetrics[];
}

// ─── Alerts ───

export async function insertAlert(alert: Omit<Alert, 'id' | 'is_read' | 'created_at'>): Promise<Alert> {
  const db = getDrizzleDb();
  const tenantId = alert.server_id ? await getTenantByServerId(alert.server_id) : 'default';
  
  const result = await db.insert(alertsTable).values({
    tenant_id: tenantId,
    server_id: alert.server_id,
    alert_type: alert.alert_type,
    severity: alert.severity,
    message: alert.message,
  }).returning({ id: alertsTable.id });

  const lastId = result[0].id;
  
  const createdAlertList = await db.select()
    .from(alertsTable)
    .where(and(
      eq(alertsTable.id, lastId),
      eq(alertsTable.tenant_id, tenantId)
    ));
    
  const createdAlert = createdAlertList[0] as Alert;

  try {
    const { notifyAlert } = require("./socket");
    notifyAlert(tenantId, createdAlert);
  } catch (err) {
    // Ignore error if socket is not available (e.g. running in worker thread)
  }

  return createdAlert;
}

export async function getAlerts(unreadOnly: boolean = false, tenantId: string): Promise<Alert[]> {
  const db = getDrizzleDb();
  const conditions = [eq(alertsTable.tenant_id, tenantId)];
  if (unreadOnly) {
    conditions.push(eq(alertsTable.is_read, 0));
  }
  
  const results = await db.select()
    .from(alertsTable)
    .where(and(...conditions))
    .orderBy(desc(alertsTable.created_at))
    .limit(100);

  return results as Alert[];
}

export async function markAlertRead(id: number, tenantId: string): Promise<void> {
  const db = getDrizzleDb();
  
  await db.update(alertsTable)
    .set({ is_read: 1 })
    .where(and(
      eq(alertsTable.id, id),
      eq(alertsTable.tenant_id, tenantId)
    ));
}

// ─── Dashboard Stats ───

export async function getDashboardStats(tenantId: string): Promise<DashboardStats> {
  const db = getDrizzleDb();

  const serverStatsList = await db.select({
    total: sql<number>`COUNT(*)`,
    online: sql<number>`SUM(CASE WHEN ${serversTable.status} = 'online' THEN 1 ELSE 0 END)`,
  })
  .from(serversTable)
  .where(eq(serversTable.tenant_id, tenantId));
  
  const serverStats = serverStatsList[0];

  const sessionStatsList = await db.select({
    count: sql<number>`COUNT(*)`,
  })
  .from(sessionsTable)
  .where(and(
    eq(sessionsTable.state, 'Active'),
    eq(sessionsTable.tenant_id, tenantId)
  ));
  
  const sessionStats = sessionStatsList[0];

  const alertStatsList = await db.select({
    count: sql<number>`COUNT(*)`,
  })
  .from(alertsTable)
  .where(and(
    eq(alertsTable.is_read, 0),
    eq(alertsTable.tenant_id, tenantId)
  ));
  
  const alertStats = alertStatsList[0];

  return {
    total_servers: Number(serverStats?.total ?? 0),
    online_servers: Number(serverStats?.online ?? 0),
    total_active_sessions: Number(sessionStats?.count ?? 0),
    unread_alerts: Number(alertStats?.count ?? 0),
  };
}

// ─── Maintenance ───

export async function cleanOldMetrics(days: number = 7): Promise<void> {
  const db = getDrizzleDb();
  
  await db.delete(metricsTable)
    .where(lt(metricsTable.timestamp, sql`TO_CHAR(NOW() - (${days} * INTERVAL '1 day'), 'YYYY-MM-DD HH24:MI:SS')`))
    .execute();
}

export async function cleanOldLogs(days: number = 90): Promise<void> {
  const db = getDrizzleDb();
  
  await db.delete(logsTable)
    .where(lt(logsTable.timestamp, sql`TO_CHAR(NOW() - (${days} * INTERVAL '1 day'), 'YYYY-MM-DD HH24:MI:SS')`))
    .execute();
}

export async function checkServerTimeouts(timeoutMinutes: number = 2): Promise<string[]> {
  const db = getDrizzleDb();
  
  const staleServers = await db.select({ id: serversTable.id })
    .from(serversTable)
    .where(and(
      eq(serversTable.status, 'online'),
      lt(serversTable.last_seen, sql`TO_CHAR(NOW() - (${timeoutMinutes} * INTERVAL '1 minute'), 'YYYY-MM-DD HH24:MI:SS')`)
    ));

  if (staleServers.length > 0) {
    const ids = staleServers.map((s) => s.id);
    
    await db.update(serversTable)
      .set({ status: 'offline' })
      .where(inArray(serversTable.id, ids));
  }

  return staleServers.map((s) => s.id);
}

export async function verifyAndRegisterServer(
  serverId: string,
  tenantId: string,
  hostname?: string,
  ramGb?: number,
  cpuModel?: string
): Promise<boolean> {
  const db = getDrizzleDb();
  
  const serverList = await db.select()
    .from(serversTable)
    .where(eq(serversTable.id, serverId));
    
  const server = serverList[0];
  if (server) {
    return server.tenant_id === tenantId;
  }

  // Check licensing limits before registering a new server
  try {
    const { getLicenseState } = await import('./license');
    const lic = await getLicenseState();
    if (!lic.valid) {
      console.warn(`[LICENSE] No valid license found. Rejecting registration of server '${serverId}'.`);
      return false;
    }

    const countRow = await db.select({ n: sql<number>`count(*)` }).from(serversTable);
    const total = Number(countRow[0]?.n ?? 0);
    if (total >= lic.maxServers) {
      console.warn(`[LICENSE] Monitored servers limit reached (${lic.maxServers}). Rejecting registration of server '${serverId}'.`);
      return false;
    }
  } catch (licErr) {
    console.error(`[LICENSE] Error validating license in verifyAndRegisterServer:`, licErr);
    return false; // Fail secure
  }
  
  try {
    const inserted = await db.insert(serversTable)
      .values({
        id: serverId,
        tenant_id: tenantId,
        hostname: hostname || serverId,
        status: 'online',
        last_seen: sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`,
        ram_gb: ramGb || null,
        cpu_model: cpuModel || null,
      })
      .onConflictDoNothing()
      .returning({ id: serversTable.id });

    if (inserted.length > 0) {
      console.log(`Auto-registered server '${serverId}' under tenant '${tenantId}'`);
      return true;
    }

    // Hubo conflicto: el id ya existía. Verificar que sea de ESTE tenant.
    const existing = await db.select({ t: serversTable.tenant_id })
      .from(serversTable)
      .where(eq(serversTable.id, serverId));
    return existing[0]?.t === tenantId;
  } catch (err) {
    console.error(`Error auto-registering server ${serverId}:`, err);
    return false;
  }
}

export async function updateServerName(
  serverId: string,
  tenantId: string,
  name: string
): Promise<boolean> {
  const db = getDrizzleDb();
  try {
    await db.update(serversTable)
      .set({ name })
      .where(and(
        eq(serversTable.id, serverId),
        eq(serversTable.tenant_id, tenantId)
      ));
    return true;
  } catch (err) {
    console.error(`Error updating server name for ${serverId}:`, err);
    return false;
  }
}

export async function createEnrollmentToken(
  tenantId: string,
  name: string,
  createdBy: string,
  maxUses: number | null,
  expiresAt: string | null
): Promise<{ success: boolean; rawToken?: string; error?: string }> {
  const db = getDrizzleDb();
  try {
    const rawToken = 'eca_enroll_' + crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await db.insert(schema.enrollment_tokens).values({
      tenant_id: tenantId,
      token_hash: tokenHash,
      name: name.trim(),
      max_uses: maxUses,
      expires_at: expiresAt,
      created_by: createdBy,
    });

    return { success: true, rawToken };
  } catch (err) {
    console.error('Error creating enrollment token:', err);
    return { success: false, error: 'Error interno de base de datos' };
  }
}

export async function validateAndConsumeEnrollToken(
  rawToken: string,
  serverGuid: string,
  hostname: string,
  clientIp?: string | null
): Promise<{ success: boolean; apiKey?: string; error?: string }> {
  const db = getDrizzleDb();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  try {
    return await db.transaction(async (tx) => {
      // 1. Fetch token and lock the row for update to avoid race conditions on used_count
      const tokenRows = await tx.select()
        .from(schema.enrollment_tokens)
        .where(eq(schema.enrollment_tokens.token_hash, tokenHash))
        .for('update');
      
      const token = tokenRows[0];
      if (!token) {
        return { success: false, error: 'Token de enrolamiento no válido o no existe' };
      }

      if (token.revoked === 1) {
        return { success: false, error: 'Token de enrolamiento revocado' };
      }

      if (token.expires_at && new Date() > new Date(token.expires_at)) {
        return { success: false, error: 'Token de enrolamiento expirado' };
      }

      if (token.max_uses !== null && token.used_count >= token.max_uses) {
        return { success: false, error: 'Cupo máximo de usos del token agotado' };
      }

      // 2. Fetch and check tenant
      const tenantRows = await tx.select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, token.tenant_id));
      
      const tenant = tenantRows[0];
      if (!tenant) {
        return { success: false, error: 'Inquilino no encontrado' };
      }

      if (tenant.status !== 'active') {
        return { success: false, error: 'Inquilino suspendido o inactivo' };
      }

      // 3. Check licensing limits (quota for the tenant, or global license max_servers)
      // Count per-tenant active device credentials (api_keys with device_id not null)
      const countRow = await tx.select({ n: sql<number>`count(*)` })
        .from(schema.api_keys)
        .where(and(
          eq(schema.api_keys.tenant_id, token.tenant_id),
          isNotNull(schema.api_keys.device_id)
        ));
      const currentDevicesCount = Number(countRow[0]?.n ?? 0);
      
      // Look up existing credentials for this server_guid under this tenant
      const existingKeyRows = await tx.select()
        .from(schema.api_keys)
        .where(and(
          eq(schema.api_keys.tenant_id, token.tenant_id),
          eq(schema.api_keys.device_id, serverGuid)
        ));
      const existingKey = existingKeyRows[0];

      // If it doesn't exist yet, we check the tenant quota limit
      if (!existingKey && tenant.max_servers !== null && currentDevicesCount >= tenant.max_servers) {
        return { success: false, error: 'Límite de servidores para este inquilino alcanzado' };
      }

      // Check global license limit
      try {
        const { getLicenseState } = await import('./license');
        const lic = await getLicenseState();
        if (!lic.valid) {
          return { success: false, error: 'El sistema no cuenta con una licencia válida' };
        }
        
        // Count total device credentials globally (api_keys with device_id not null)
        const globalCountRow = await tx.select({ n: sql<number>`count(*)` })
          .from(schema.api_keys)
          .where(isNotNull(schema.api_keys.device_id));
        const globalTotal = Number(globalCountRow[0]?.n ?? 0);
        
        if (!existingKey && globalTotal >= lic.maxServers) {
          return { success: false, error: 'Límite global de servidores de la licencia alcanzado' };
        }
      } catch (licErr) {
        console.error('Error checking license during enroll:', licErr);
        return { success: false, error: 'Error de verificación de licencia' };
      }

      // 4. Generate new per-equipment API Key hash
      const rawKey = 'eca_dev_' + crypto.randomBytes(16).toString('hex');
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      let targetKeyId: number;

      if (existingKey) {
        // Idempotency: Rotate key_hash, don't increment used_count
        await tx.update(schema.api_keys)
          .set({ 
            key_hash: keyHash, 
            name: `Agente Enrolado: ${hostname || 'Desconocido'}` 
          })
          .where(eq(schema.api_keys.id, existingKey.id));
        targetKeyId = existingKey.id;
      } else {
        // Insert new API key
        const insertedKey = await tx.insert(schema.api_keys).values({
          tenant_id: token.tenant_id,
          name: `Agente Enrolado: ${hostname || 'Desconocido'}`,
          key_hash: keyHash,
          device_id: serverGuid,
          enrolled_via: token.id,
        }).returning({ id: schema.api_keys.id });
        targetKeyId = insertedKey[0].id;

        // 5. Update used_count (only for new enrollments)
        await tx.update(schema.enrollment_tokens)
          .set({ used_count: token.used_count + 1 })
          .where(eq(schema.enrollment_tokens.id, token.id));
      }

      // 6. Log audit entry
      await tx.insert(schema.admin_audit_logs).values({
        tenant_id: token.tenant_id,
        username: 'SYSTEM (Enrolamiento)',
        action: 'agent_enroll',
        ip_address: clientIp || null,
        details: JSON.stringify({ 
          server_guid: serverGuid, 
          hostname, 
          token_name: token.name,
          api_key_id: targetKeyId,
          is_rotation: !!existingKey
        }),
      });

      return { success: true, apiKey: rawKey };
    });
  } catch (err) {
    console.error('Error during validateAndConsumeEnrollToken:', err);
    return { success: false, error: 'Error interno de base de datos durante el enrolamiento' };
  }
}

export async function revokeEnrollmentToken(
  tokenId: number,
  tenantId: string
): Promise<boolean> {
  const db = getDrizzleDb();
  try {
    await db.update(schema.enrollment_tokens)
      .set({ revoked: 1 })
      .where(and(
        eq(schema.enrollment_tokens.id, tokenId),
        eq(schema.enrollment_tokens.tenant_id, tenantId)
      ));
    return true;
  } catch (err) {
    console.error(`Error revoking enrollment token ${tokenId}:`, err);
    return false;
  }
}

