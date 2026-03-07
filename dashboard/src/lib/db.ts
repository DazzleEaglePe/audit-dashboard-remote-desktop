import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ═══════════════════════════════════════════════════════
// SQLite Database Connection — Singleton
// ═══════════════════════════════════════════════════════

const DB_PATH = process.env.DATABASE_PATH || './data/audit.db';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  const dir = path.dirname(path.resolve(DB_PATH));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(path.resolve(DB_PATH));

  // Performance optimizations for SQLite
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Initialize schema
  initializeSchema(db);

  return db;
}

function initializeSchema(db: Database.Database): void {
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
  
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  }
}

// ═══════════════════════════════════════════════════════
// Query Helpers
// ═══════════════════════════════════════════════════════

import type {
  Server,
  Session,
  SessionLog,
  ServerMetrics,
  Alert,
  ServerWithMetrics,
  DashboardStats,
} from '@/types';

// ─── Servers ───

export function getAllServers(): ServerWithMetrics[] {
  const db = getDb();
  const servers = db.prepare('SELECT * FROM servers ORDER BY id').all() as Server[];

  return servers.map((server) => {
    const metrics = db
      .prepare(
        'SELECT * FROM server_metrics WHERE server_id = ? ORDER BY timestamp DESC LIMIT 1'
      )
      .get(server.id) as ServerMetrics | undefined;

    const activeCount = db
      .prepare(
        "SELECT COUNT(*) as count FROM sessions WHERE server_id = ? AND state = 'Active'"
      )
      .get(server.id) as { count: number };

    return {
      ...server,
      metrics: metrics || null,
      active_sessions_count: activeCount.count,
    };
  });
}

export function getServerById(id: string): ServerWithMetrics | null {
  const db = getDb();
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as Server | undefined;
  if (!server) return null;

  const metrics = db
    .prepare(
      'SELECT * FROM server_metrics WHERE server_id = ? ORDER BY timestamp DESC LIMIT 1'
    )
    .get(id) as ServerMetrics | undefined;

  const sessions = db
    .prepare('SELECT * FROM sessions WHERE server_id = ? ORDER BY username')
    .all(id) as Session[];

  return {
    ...server,
    metrics: metrics || null,
    sessions,
    active_sessions_count: sessions.filter((s) => s.state === 'Active').length,
  };
}

// ─── Sessions ───

export function getAllActiveSessions(): Session[] {
  const db = getDb();
  return db
    .prepare(`
      SELECT 
        sessions.*, 
        servers.status as server_status
      FROM sessions
      LEFT JOIN servers ON sessions.server_id = servers.id
      ORDER BY sessions.server_id, sessions.username
    `)
    .all() as Session[];
}

export function upsertSessions(serverId: string, sessions: Partial<Session>[]): void {
  const db = getDb();

  const upsert = db.prepare(`
    INSERT INTO sessions (server_id, username, session_id, state, logon_time, source_ip, idle_time, updated_at)
    VALUES (@server_id, @username, @session_id, @state, @logon_time, @source_ip, @idle_time, datetime('now'))
    ON CONFLICT(server_id, username, session_id)
    DO UPDATE SET state = @state, idle_time = @idle_time, source_ip = @source_ip, updated_at = datetime('now')
  `);

  // Remove stale sessions: build composite keys (session_id, username) to avoid
  // false retention when Windows reuses session IDs for different users
  if (sessions.length > 0) {
    const compositeKeys = sessions.map((s) => `${s.session_id}|${s.username}`);
    const allCurrent = db.prepare('SELECT session_id, username FROM sessions WHERE server_id = ?').all(serverId) as { session_id: number; username: string }[];
    const toDelete = allCurrent.filter((r) => !compositeKeys.includes(`${r.session_id}|${r.username}`));
    const deleteStmt = db.prepare('DELETE FROM sessions WHERE server_id = ? AND session_id = ? AND username = ?');
    for (const row of toDelete) {
      deleteStmt.run(serverId, row.session_id, row.username);
    }
  } else {
    // No active sessions → remove all for this server
    db.prepare('DELETE FROM sessions WHERE server_id = ?').run(serverId);
  }

  // Upsert active ones
  const runAll = db.transaction(() => {
    for (const session of sessions) {
      upsert.run({
        server_id: serverId,
        username: session.username,
        session_id: session.session_id,
        state: session.state || 'Active',
        logon_time: session.logon_time || null,
        source_ip: session.source_ip || null,
        idle_time: session.idle_time || null,
      });
    }
  });

  runAll();
}

// ─── Session Logs ───

export function insertSessionLog(log: Omit<SessionLog, 'id' | 'created_at'>): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO session_logs (server_id, username, event_type, session_id, source_ip, timestamp, details)
    VALUES (@server_id, @username, @event_type, @session_id, @source_ip, @timestamp, @details)
  `).run(log);
}

export function getSessionLogs(filters: {
  from?: string;
  to?: string;
  username?: string;
  server_id?: string;
  limit?: number;
  offset?: number;
}): { logs: SessionLog[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.from) {
    conditions.push('timestamp >= @from');
    params.from = filters.from;
  }
  if (filters.to) {
    conditions.push('timestamp <= @to');
    params.to = filters.to;
  }
  if (filters.username) {
    conditions.push('username = @username');
    params.username = filters.username;
  }
  if (filters.server_id) {
    conditions.push('server_id = @server_id');
    params.server_id = filters.server_id;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM session_logs ${where}`)
    .get(params) as { count: number };

  const logs = db
    .prepare(`SELECT * FROM session_logs ${where} ORDER BY timestamp DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset }) as SessionLog[];

  return { logs, total: total.count };
}

// ─── Server Metrics ───

export function insertServerMetrics(
  serverId: string,
  metrics: { cpu_percent: number; ram_used_mb: number; ram_total_mb: number; disk_percent: number },
  activeSessionsCount: number
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO server_metrics (server_id, cpu_percent, ram_used_mb, ram_total_mb, disk_percent, active_sessions)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(serverId, metrics.cpu_percent, metrics.ram_used_mb, metrics.ram_total_mb, metrics.disk_percent, activeSessionsCount);

  // Update server status
  db.prepare("UPDATE servers SET status = 'online', last_seen = datetime('now') WHERE id = ?").run(
    serverId
  );
}

export function getServerMetricsHistory(
  serverId: string,
  hours: number = 1
): ServerMetrics[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM server_metrics 
       WHERE server_id = ? AND timestamp >= datetime('now', ? || ' hours')
       ORDER BY timestamp ASC`
    )
    .all(serverId, -hours) as ServerMetrics[];
}

// ─── Alerts ───

export function insertAlert(alert: Omit<Alert, 'id' | 'is_read' | 'created_at'>): Alert {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO alerts (server_id, alert_type, severity, message)
    VALUES (@server_id, @alert_type, @severity, @message)
  `).run(alert);

  return db.prepare('SELECT * FROM alerts WHERE id = ?').get(result.lastInsertRowid) as Alert;
}

export function getAlerts(unreadOnly: boolean = false): Alert[] {
  const db = getDb();
  const where = unreadOnly ? 'WHERE is_read = 0' : '';
  return db
    .prepare(`SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT 100`)
    .all() as Alert[];
}

export function markAlertRead(id: number): void {
  const db = getDb();
  db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(id);
}

// ─── Dashboard Stats ───

export function getDashboardStats(): DashboardStats {
  const db = getDb();

  const servers = db
    .prepare('SELECT COUNT(*) as total, SUM(CASE WHEN status = \'online\' THEN 1 ELSE 0 END) as online FROM servers')
    .get() as { total: number; online: number };

  const sessions = db
    .prepare("SELECT COUNT(*) as count FROM sessions WHERE state = 'Active'")
    .get() as { count: number };

  const alerts = db
    .prepare('SELECT COUNT(*) as count FROM alerts WHERE is_read = 0')
    .get() as { count: number };

  return {
    total_servers: servers.total,
    online_servers: servers.online || 0,
    total_active_sessions: sessions.count,
    unread_alerts: alerts.count,
  };
}

// ─── Maintenance ───

export function cleanOldMetrics(days: number = 7): void {
  const db = getDb();
  db.prepare(
    `DELETE FROM server_metrics WHERE timestamp < datetime('now', ? || ' days')`
  ).run(-days);
}

export function checkServerTimeouts(timeoutMinutes: number = 2): string[] {
  const db = getDb();
  const staleServers = db
    .prepare(
      `SELECT id FROM servers 
       WHERE status = 'online' 
       AND last_seen < datetime('now', ? || ' minutes')`
    )
    .all(-timeoutMinutes) as { id: string }[];

  if (staleServers.length > 0) {
    const ids = staleServers.map((s) => s.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(
      `UPDATE servers SET status = 'offline' WHERE id IN (${placeholders})`
    ).run(...ids);
  }

  return staleServers.map((s) => s.id);
}
