-- ═══════════════════════════════════════════════════════
-- Schema: Sistema de Auditoría RDP — ECA
-- Database: SQLite (via better-sqlite3)
-- ═══════════════════════════════════════════════════════

-- Servidores monitoreados
CREATE TABLE IF NOT EXISTS servers (
  id            TEXT PRIMARY KEY,          -- 'srv1', 'srv2', 'srv3'
  hostname      TEXT NOT NULL,             -- 'DESKTOP-E4F6THB'
  ip_lan        TEXT,                      -- '192.168.18.4'
  ip_tailscale  TEXT,                      -- '100.108.248.45'
  cpu_model     TEXT,                      -- 'Intel Core i5-10400'
  ram_gb        INTEGER,                   -- 32
  status        TEXT DEFAULT 'offline',    -- 'online', 'offline'
  last_seen     TEXT,                      -- ISO 8601 datetime
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Sesiones RDP activas (snapshot actualizado por cada heartbeat)
CREATE TABLE IF NOT EXISTS sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id     TEXT NOT NULL REFERENCES servers(id),
  username      TEXT NOT NULL,             -- 'CONT', 'SIST4'
  session_id    INTEGER,                   -- Windows session ID
  state         TEXT DEFAULT 'Active',     -- 'Active', 'Idle', 'Disconnected'
  logon_time    TEXT,                      -- ISO 8601
  source_ip     TEXT,
  idle_time     TEXT,                      -- 'HH:MM:SS'
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(server_id, username, session_id)
);

-- Logs de conexión/desconexión (histórico persistente)
CREATE TABLE IF NOT EXISTS session_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id     TEXT NOT NULL REFERENCES servers(id),
  username      TEXT NOT NULL,
  event_type    TEXT NOT NULL,             -- 'connect', 'disconnect', 'idle', 'active'
  session_id    INTEGER,
  source_ip     TEXT,
  timestamp     TEXT NOT NULL,             -- ISO 8601
  details       TEXT,                      -- JSON extra info
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Métricas de servidores (histórico para gráficos)
CREATE TABLE IF NOT EXISTS server_metrics (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id       TEXT NOT NULL REFERENCES servers(id),
  cpu_percent     REAL,
  ram_used_mb     INTEGER,
  ram_total_mb    INTEGER,
  disk_percent    REAL,
  active_sessions INTEGER,
  timestamp       TEXT DEFAULT (datetime('now'))
);

-- Alertas del sistema
CREATE TABLE IF NOT EXISTS alerts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id     TEXT REFERENCES servers(id),
  alert_type    TEXT NOT NULL,             -- 'server_down', 'session_idle', 'high_cpu', 'login_failed', 'rdp_wrapper_broken'
  severity      TEXT DEFAULT 'info',       -- 'info', 'warning', 'critical'
  message       TEXT,
  is_read       INTEGER DEFAULT 0,         -- 0=false, 1=true (SQLite boolean)
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════ INDEXES ═══════════════════════════

CREATE INDEX IF NOT EXISTS idx_session_logs_timestamp ON session_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_session_logs_username ON session_logs(username);
CREATE INDEX IF NOT EXISTS idx_session_logs_server ON session_logs(server_id);
CREATE INDEX IF NOT EXISTS idx_server_metrics_server_time ON server_metrics(server_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_server ON sessions(server_id);

-- ═══════════════════════════ SEED DATA ═══════════════════════════

INSERT OR IGNORE INTO servers (id, hostname, ip_lan, ip_tailscale, cpu_model, ram_gb) VALUES
  ('srv1', 'DESKTOP-E4F6THB', '192.168.18.4',   '100.108.248.45', 'Intel Core i5-10400', 32),
  ('srv2', 'DESKTOP-TR7OGR1', '192.168.18.31',  '100.112.15.36',  'Intel Core i5-6500T', 16),
  ('srv3', 'DESKTOP-LKSNKOL', '192.168.18.136', '100.109.28.98',  'Intel Core i5-4590S', 16);
