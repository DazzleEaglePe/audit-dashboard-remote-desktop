import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// 1. Tabla de Servidores Monitoreados
export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),                               // 'srv1', 'srv2', 'srv3'
  hostname: text('hostname').notNull(),                      // 'DESKTOP-E4F6THB'
  ip_lan: text('ip_lan'),                                    // '192.168.18.4'
  ip_tailscale: text('ip_tailscale'),                        // '100.108.248.45'
  cpu_model: text('cpu_model'),                              // 'Intel Core i5-10400'
  ram_gb: integer('ram_gb'),                                 // 32
  status: text('status').default('offline'),                 // 'online', 'offline'
  last_seen: text('last_seen'),                              // ISO 8601 datetime
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

// 2. Tabla de Sesiones Activas (Snapshot de Heartbeat)
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  server_id: text('server_id').notNull().references(() => servers.id),
  username: text('username').notNull(),                      // 'CONT', 'SIST4'
  session_id: integer('session_id'),                         // Windows session ID
  state: text('state').default('Active'),                    // 'Active', 'Idle', 'Disconnected'
  logon_time: text('logon_time'),                            // ISO 8601
  source_ip: text('source_ip'),
  idle_time: text('idle_time'),                              // 'HH:MM:SS'
  full_name: text('full_name'),                              // Windows User Display Name
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
});

// 3. Tabla de Logs de Auditoría RDP (Historial)
export const session_logs = sqliteTable('session_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  server_id: text('server_id').notNull().references(() => servers.id),
  username: text('username').notNull(),
  event_type: text('event_type').notNull(),                  // 'connect', 'disconnect', 'idle', 'active'
  session_id: integer('session_id'),
  source_ip: text('source_ip'),
  timestamp: text('timestamp').notNull(),                    // ISO 8601
  details: text('details'),                                  // JSON extra info
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

// 4. Tabla de Métricas de Servidor (para Gráficos)
export const server_metrics = sqliteTable('server_metrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  server_id: text('server_id').notNull().references(() => servers.id),
  cpu_percent: real('cpu_percent'),
  ram_used_mb: integer('ram_used_mb'),
  ram_total_mb: integer('ram_total_mb'),
  disk_percent: real('disk_percent'),
  active_sessions: integer('active_sessions'),
  timestamp: text('timestamp').default(sql`(datetime('now'))`),
});

// 5. Tabla de Alertas del Sistema
export const alerts = sqliteTable('alerts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  server_id: text('server_id').references(() => servers.id),
  alert_type: text('alert_type').notNull(),                  // 'server_down', 'session_idle', 'high_cpu'
  severity: text('severity').default('info'),                // 'info', 'warning', 'critical'
  message: text('message'),
  is_read: integer('is_read').default(0),                    // 0=false, 1=true (SQLite boolean)
  created_at: text('created_at').default(sql`(datetime('now'))`),
});
