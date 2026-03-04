// ═══════════════════════════════════════════════════════
// TypeScript Types — Sistema de Auditoría RDP ECA
// ═══════════════════════════════════════════════════════

// ─── Database Models ───

export interface Server {
  id: string;
  hostname: string;
  ip_lan: string | null;
  ip_tailscale: string | null;
  cpu_model: string | null;
  ram_gb: number | null;
  status: 'online' | 'offline';
  last_seen: string | null;
  created_at: string;
}

export interface Session {
  id: number;
  server_id: string;
  username: string;
  session_id: number;
  state: 'Active' | 'Idle' | 'Disconnected';
  logon_time: string | null;
  source_ip: string | null;
  idle_time: string | null;
  updated_at: string;
}

export interface SessionLog {
  id: number;
  server_id: string;
  username: string;
  event_type: 'connect' | 'disconnect' | 'idle' | 'active';
  session_id: number | null;
  source_ip: string | null;
  timestamp: string;
  details: string | null;
  created_at: string;
}

export interface ServerMetrics {
  id: number;
  server_id: string;
  cpu_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  disk_percent: number;
  active_sessions: number;
  timestamp: string;
}

export interface Alert {
  id: number;
  server_id: string | null;
  alert_type: 'server_down' | 'session_idle' | 'high_cpu' | 'login_failed' | 'rdp_wrapper_broken';
  severity: 'info' | 'warning' | 'critical';
  message: string | null;
  is_read: number; // 0 or 1 (SQLite boolean)
  created_at: string;
}

// ─── API Payloads (Agent → Dashboard) ───

export interface AgentSessionData {
  username: string;
  session_id: number;
  state: string;
  idle_time: string;
  logon_time: string;
  source_ip: string;
}

export interface AgentHeartbeatPayload {
  server_id: string;
  hostname: string;
  metrics: {
    cpu_percent: number;
    ram_used_mb: number;
    ram_total_mb: number;
    disk_percent: number;
  };
  sessions: AgentSessionData[];
}

export interface AgentEventPayload {
  server_id: string;
  event_type: string;
  username: string;
  session_id: number;
  source_ip: string;
  timestamp: string;
}

// ─── API Responses ───

export interface ServerWithMetrics extends Server {
  metrics?: ServerMetrics | null;
  active_sessions_count?: number;
  sessions?: Session[];
}

export interface DashboardStats {
  total_servers: number;
  online_servers: number;
  total_active_sessions: number;
  unread_alerts: number;
}

// ─── WebSocket Events ───

export interface WSServerUpdate {
  server_id: string;
  status: string;
  metrics: ServerMetrics;
}

export interface WSSessionChange {
  server_id: string;
  username: string;
  event_type: string;
  session_id: number;
  timestamp: string;
}

export interface WSScreenshotUpdate {
  server_id: string;
  username: string;
  session_id: number;
  image_url: string;
  timestamp: string;
}

export interface WSAlertNew {
  alert: Alert;
}
