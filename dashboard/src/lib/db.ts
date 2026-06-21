import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql, eq, and, desc, lt, gte, lte, inArray } from 'drizzle-orm';
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
} from '@/types';

// ═══════════════════════════════════════════════════════
// SQLite Database Connection & Drizzle ORM Instance
// ═══════════════════════════════════════════════════════

const DB_PATH = process.env.DATABASE_PATH || './data/audit.db';

let rawDb: Database.Database | null = null;
let drizzleDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(): Database.Database {
  if (rawDb) return rawDb;

  // Ensure data directory exists
  const dir = path.dirname(path.resolve(DB_PATH));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  rawDb = new Database(path.resolve(DB_PATH));

  // Performance optimizations for SQLite
  rawDb.pragma('journal_mode = WAL');
  rawDb.pragma('synchronous = NORMAL');
  rawDb.pragma('foreign_keys = ON');

  // Initialize schema using legacy script if it exists
  initializeSchema(rawDb);

  return rawDb;
}

export function getDrizzleDb() {
  if (drizzleDb) return drizzleDb;
  const rawConnection = getDb();
  drizzleDb = drizzle(rawConnection, { schema });
  return drizzleDb;
}

function initializeSchema(db: Database.Database): void {
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
  
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);
  }

  // Database migration: dynamically add full_name column if it does not exist
  try {
    const columns = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
    if (!columns.some(col => col.name === 'full_name')) {
      db.exec("ALTER TABLE sessions ADD COLUMN full_name TEXT;");
      console.log("Database migrated: Added 'full_name' column to 'sessions' table.");
    }
  } catch (err) {
    console.error("Migration error for sessions table:", err);
  }
}

// ═══════════════════════════════════════════════════════
// Drizzle ORM Query Helpers
// ═══════════════════════════════════════════════════════

// ─── Servers ───

export function getAllServers(): ServerWithMetrics[] {
  const db = getDrizzleDb();
  
  // Get all servers
  const allServers = db.select().from(serversTable).orderBy(serversTable.id).all();

  return allServers.map((server) => {
    // Get latest metrics
    const metrics = db.select()
      .from(metricsTable)
      .where(eq(metricsTable.server_id, server.id))
      .orderBy(desc(metricsTable.timestamp))
      .limit(1)
      .get();

    // Get active sessions count
    const activeSessions = db.select()
      .from(sessionsTable)
      .where(and(
        eq(sessionsTable.server_id, server.id),
        eq(sessionsTable.state, 'Active')
      ))
      .all();

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
  }) as ServerWithMetrics[];
}

export function getServerById(id: string): ServerWithMetrics | null {
  const db = getDrizzleDb();
  
  const server = db.select()
    .from(serversTable)
    .where(eq(serversTable.id, id))
    .get();

  if (!server) return null;

  const metrics = db.select()
    .from(metricsTable)
    .where(eq(metricsTable.server_id, id))
    .orderBy(desc(metricsTable.timestamp))
    .limit(1)
    .get();

  const sessionsList = db.select()
    .from(sessionsTable)
    .where(eq(sessionsTable.server_id, id))
    .orderBy(sessionsTable.username)
    .all();

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

export function getAllActiveSessions(): Session[] {
  const db = getDrizzleDb();
  
  const results = db.select({
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
  .orderBy(sessionsTable.server_id, sessionsTable.username)
  .all();

  return results.map((s) => ({
    ...s,
    session_id: s.session_id ?? 0,
    updated_at: s.updated_at ?? '',
    state: s.state as 'Active' | 'Idle' | 'Disconnected',
    server_status: s.server_status as 'online' | 'offline' | undefined,
  })) as Session[];
}

export function upsertSessions(serverId: string, sessionsList: Partial<Session>[]): void {
  const db = getDrizzleDb();

  // Get current active sessions for this server
  const allCurrent = db.select({
    session_id: sessionsTable.session_id,
    username: sessionsTable.username,
  })
  .from(sessionsTable)
  .where(eq(sessionsTable.server_id, serverId))
  .all();
  
  const currentKeys = allCurrent.map((r) => `${r.session_id}|${r.username}`);
  
  db.transaction((tx) => {
    if (sessionsList.length > 0) {
      const incomingKeys = sessionsList.map((s) => `${s.session_id}|${s.username}`);
      const toDelete = allCurrent.filter((r) => !incomingKeys.includes(`${r.session_id}|${r.username}`));
      const newSessions = sessionsList.filter((s) => !currentKeys.includes(`${s.session_id}|${s.username}`));

      // Log and delete stale sessions
      for (const row of toDelete) {
        tx.insert(logsTable).values({
          server_id: serverId,
          username: row.username,
          event_type: 'disconnect',
          session_id: row.session_id,
          source_ip: null,
          timestamp: sql`datetime('now')`,
          details: 'Desconexión automática inferida por Heartbeat',
        }).run();

        tx.delete(sessionsTable)
          .where(and(
            eq(sessionsTable.server_id, serverId),
            eq(sessionsTable.session_id, row.session_id!),
            eq(sessionsTable.username, row.username)
          )).run();
      }

      // Log new connects
      for (const s of newSessions) {
        tx.insert(logsTable).values({
          server_id: serverId,
          username: s.username!,
          event_type: 'connect',
          session_id: s.session_id!,
          source_ip: s.source_ip || null,
          timestamp: sql`datetime('now')`,
          details: 'Conexión automática inferida por Heartbeat',
        }).run();
      }
    } else {
      // Remove all sessions and log disconnects
      for (const row of allCurrent) {
        tx.insert(logsTable).values({
          server_id: serverId,
          username: row.username,
          event_type: 'disconnect',
          session_id: row.session_id,
          source_ip: null,
          timestamp: sql`datetime('now')`,
          details: 'Desconexión masiva (Servidor vacío)',
        }).run();
      }
      tx.delete(sessionsTable).where(eq(sessionsTable.server_id, serverId)).run();
    }

    // Upsert active sessions
    for (const session of sessionsList) {
      tx.insert(sessionsTable)
        .values({
          server_id: serverId,
          username: session.username!,
          session_id: session.session_id!,
          state: session.state || 'Active',
          logon_time: session.logon_time || null,
          source_ip: session.source_ip || null,
          idle_time: session.idle_time || null,
          full_name: session.full_name || null,
          updated_at: sql`datetime('now')`,
        })
        .onConflictDoUpdate({
          target: [sessionsTable.server_id, sessionsTable.username, sessionsTable.session_id],
          set: {
            state: session.state || 'Active',
            idle_time: session.idle_time || null,
            source_ip: session.source_ip || null,
            full_name: session.full_name || null,
            updated_at: sql`datetime('now')`,
          },
        })
        .run();
    }
  });
}

// ─── Session Logs ───

export function insertSessionLog(log: Omit<SessionLog, 'id' | 'created_at'>): void {
  const db = getDrizzleDb();
  
  db.insert(logsTable).values({
    server_id: log.server_id,
    username: log.username,
    event_type: log.event_type,
    session_id: log.session_id,
    source_ip: log.source_ip,
    timestamp: log.timestamp,
    details: log.details,
  }).run();
}

export function getSessionLogs(filters: {
  from?: string;
  to?: string;
  username?: string;
  server_id?: string;
  limit?: number;
  offset?: number;
}): { logs: SessionLog[]; total: number } {
  const db = getDrizzleDb();
  const conditions = [];

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

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  // Get total count
  const countResult = db.select({
    count: sql<number>`COUNT(*)`
  })
  .from(logsTable)
  .where(whereClause)
  .get();

  const total = countResult?.count ?? 0;

  // Get paginated results
  const logsList = db.select()
    .from(logsTable)
    .where(whereClause)
    .orderBy(desc(logsTable.timestamp))
    .limit(limit)
    .offset(offset)
    .all();

  return { 
    logs: logsList.map((l) => ({
      ...l,
      event_type: l.event_type as 'connect' | 'disconnect' | 'idle' | 'active',
    })) as SessionLog[], 
    total,
  };
}

// ─── Server Metrics ───

export function insertServerMetrics(
  serverId: string,
  metrics: { cpu_percent: number; ram_used_mb: number; ram_total_mb: number; disk_percent: number },
  activeSessionsCount: number
): void {
  const db = getDrizzleDb();
  
  db.transaction((tx) => {
    tx.insert(metricsTable).values({
      server_id: serverId,
      cpu_percent: metrics.cpu_percent,
      ram_used_mb: metrics.ram_used_mb,
      ram_total_mb: metrics.ram_total_mb,
      disk_percent: metrics.disk_percent,
      active_sessions: activeSessionsCount,
    }).run();

    tx.update(serversTable)
      .set({
        status: 'online',
        last_seen: sql`datetime('now')`,
      })
      .where(eq(serversTable.id, serverId))
      .run();
  });
}

export function getServerMetricsHistory(
  serverId: string,
  hours: number = 1
): ServerMetrics[] {
  const db = getDrizzleDb();
  
  const list = db.select()
    .from(metricsTable)
    .where(and(
      eq(metricsTable.server_id, serverId),
      gte(metricsTable.timestamp, sql`datetime('now', ${-hours} || ' hours')`)
    ))
    .orderBy(metricsTable.timestamp)
    .all();

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

export function insertAlert(alert: Omit<Alert, 'id' | 'is_read' | 'created_at'>): Alert {
  const db = getDrizzleDb();
  
  const result = db.insert(alertsTable).values({
    server_id: alert.server_id,
    alert_type: alert.alert_type,
    severity: alert.severity,
    message: alert.message,
  }).run();

  const lastId = Number(result.lastInsertRowid);
  
  return db.select()
    .from(alertsTable)
    .where(eq(alertsTable.id, lastId))
    .get() as Alert;
}

export function getAlerts(unreadOnly: boolean = false): Alert[] {
  const db = getDrizzleDb();
  const condition = unreadOnly ? eq(alertsTable.is_read, 0) : undefined;
  
  return db.select()
    .from(alertsTable)
    .where(condition)
    .orderBy(desc(alertsTable.created_at))
    .limit(100)
    .all() as Alert[];
}

export function markAlertRead(id: number): void {
  const db = getDrizzleDb();
  
  db.update(alertsTable)
    .set({ is_read: 1 })
    .where(eq(alertsTable.id, id))
    .run();
}

// ─── Dashboard Stats ───

export function getDashboardStats(): DashboardStats {
  const db = getDrizzleDb();

  const serverStats = db.select({
    total: sql<number>`COUNT(*)`,
    online: sql<number>`SUM(CASE WHEN ${serversTable.status} = 'online' THEN 1 ELSE 0 END)`,
  })
  .from(serversTable)
  .get();

  const sessionStats = db.select({
    count: sql<number>`COUNT(*)`,
  })
  .from(sessionsTable)
  .where(eq(sessionsTable.state, 'Active'))
  .get();

  const alertStats = db.select({
    count: sql<number>`COUNT(*)`,
  })
  .from(alertsTable)
  .where(eq(alertsTable.is_read, 0))
  .get();

  return {
    total_servers: serverStats?.total ?? 0,
    online_servers: serverStats?.online ?? 0,
    total_active_sessions: sessionStats?.count ?? 0,
    unread_alerts: alertStats?.count ?? 0,
  };
}

// ─── Maintenance ───

export function cleanOldMetrics(days: number = 7): void {
  const db = getDrizzleDb();
  
  db.delete(metricsTable)
    .where(lt(metricsTable.timestamp, sql`datetime('now', ${-days} || ' days')`))
    .run();
}

export function cleanOldLogs(days: number = 90): void {
  const db = getDrizzleDb();
  
  db.delete(logsTable)
    .where(lt(logsTable.timestamp, sql`datetime('now', ${-days} || ' days')`))
    .run();
}

export function checkServerTimeouts(timeoutMinutes: number = 2): string[] {
  const db = getDrizzleDb();
  
  const staleServers = db.select({ id: serversTable.id })
    .from(serversTable)
    .where(and(
      eq(serversTable.status, 'online'),
      lt(serversTable.last_seen, sql`datetime('now', ${-timeoutMinutes} || ' minutes')`)
    ))
    .all();

  if (staleServers.length > 0) {
    const ids = staleServers.map((s) => s.id);
    
    db.update(serversTable)
      .set({ status: 'offline' })
      .where(inArray(serversTable.id, ids))
      .run();
  }

  return staleServers.map((s) => s.id);
}
