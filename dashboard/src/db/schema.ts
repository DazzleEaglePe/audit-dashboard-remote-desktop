import { pgTable, text, integer, real, serial, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. Tabla de Inquilinos / Empresas (Tenants)
export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),                               // Slug único (ej. 'default', 'empresa-a')
  name: text('name').notNull(),                              // Nombre de la empresa
  status: text('status').default('active'),                  // 'active' | 'suspended' | 'expired'
  plan: text('plan').default('basic'),                       // 'free' | 'basic' | 'premium' | 'custom'
  max_servers: integer('max_servers').default(5),            // Límite de servidores permitidos
  expires_at: text('expires_at'),                            // Fecha de expiración de la licencia (ISO 8601)
  domain: text('domain'),                                    // Dominio o subdominio personalizado opcional
  created_at: text('created_at').default(sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`),
});

// 2. Tabla de Ajustes del Inquilino (SMTP, Slack, Teams)
export const tenant_settings = pgTable('tenant_settings', {
  tenant_id: text('tenant_id').primaryKey().references(() => tenants.id, { onDelete: 'cascade' }),
  alert_emails: text('alert_emails'),                        // Correos destinatarios en CSV (ej. 'a@b.com,c@d.com')
  slack_webhook_url: text('slack_webhook_url'),              // Webhook de Slack
  teams_webhook_url: text('teams_webhook_url'),              // Webhook de Microsoft Teams
  custom_smtp_host: text('custom_smtp_host'),                // Host SMTP dedicado
  custom_smtp_port: integer('custom_smtp_port'),            // Puerto SMTP dedicado
  custom_smtp_user: text('custom_smtp_user'),                // Usuario SMTP dedicado
  custom_smtp_pass: text('custom_smtp_pass'),                // Contraseña SMTP dedicada (encriptada)
  custom_smtp_from: text('custom_smtp_from'),                // Correo remitente personalizado
});

// 3. Tabla de Usuarios (Administradores/Visualizadores por Tenant)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  tenant_id: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  username: text('username').notNull().unique(),             // Nombre de usuario único
  password_hash: text('password_hash').notNull(),            // Hash Bcrypt
  full_name: text('full_name'),                              // Nombre para mostrar
  email: text('email'),                                      // Correo de contacto
  avatar_url: text('avatar_url'),                            // URL o Base64
  role: text('role').default('admin'),                       // 'superadmin' | 'admin' | 'viewer'
  activation_token: text('activation_token'),                // Token de un solo uso para onboarding
  activation_token_expires_at: text('activation_token_expires_at'), // Expiración del token (ISO 8601)
  password_change_required: integer('password_change_required').default(0), // 1 = Sí, 0 = No
  created_at: text('created_at').default(sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`),
});

// 4. Tabla de Notificaciones del Sistema (con soporte SMTP)
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  tenant_id: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),                            // Título (ej. 'Licencia por vencer')
  message: text('message').notNull(),                        // Detalle del mensaje
  type: text('type').default('system'),                      // 'license_expiry' | 'quota_alert' | 'system'
  is_read: integer('is_read').default(0),                    // 0 = No leído, 1 = Leído
  email_sent: integer('email_sent'),                         // 0 = Pendiente, 1 = Enviado, 2 = Fallido, NULL = No requiere
  recipient_email: text('recipient_email'),                  // Correo del destinatario
  created_at: text('created_at').default(sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`),
});

// 14. Tabla de Tokens de Enrolamiento (Bootstrap para Agentes)
export const enrollment_tokens = pgTable('enrollment_tokens', {
  id: serial('id').primaryKey(),
  tenant_id: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  token_hash: text('token_hash').notNull().unique(),         // Hash SHA-256 del token
  name: text('name').notNull(),                              // Nombre descriptivo (ej. 'Despliegue GPO 2026')
  max_uses: integer('max_uses'),                             // null = ilimitado
  used_count: integer('used_count').default(0).notNull(),
  expires_at: text('expires_at'),                            // Fecha ISO 8601
  revoked: integer('revoked').default(0).notNull(),          // 1 = Revocado, 0 = Activo
  created_by: text('created_by'),                            // Usuario admin que lo creó
  created_at: text('created_at').default(sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`),
}, (table) => [
  index('enrollment_tokens_tenant_id_idx').on(table.tenant_id),
]);

// 5. API Keys por Inquilino (para Agentes C#)
export const api_keys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  tenant_id: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                              // Nombre descriptivo (ej. 'Agente Servidor Principal')
  key_hash: text('key_hash').notNull().unique(),             // Hash SHA-256 de la API Key
  expires_at: text('expires_at'),                            // Fecha de vencimiento (ISO 8601)
  created_at: text('created_at').default(sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`),
  last_used_at: text('last_used_at'),                        // Última vez usada (ISO 8601)
  device_id: text('device_id'),                              // server_guid del equipo bindeado
  enrolled_via: integer('enrolled_via').references(() => enrollment_tokens.id, { onDelete: 'set null' }), // token de enrolamiento de procedencia
}, (table) => [
  index('api_keys_tenant_id_device_id_idx').on(table.tenant_id, table.device_id),
]);

// 6. Tabla de Servidores Monitoreados
export const servers = pgTable('servers', {
  id: text('id').primaryKey(),                               // 'srv1', 'srv2', etc.
  tenant_id: text('tenant_id').default('default').references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name'),                                        // Nombre amigable (ej. 'Servidor Central')
  hostname: text('hostname').notNull(),                      
  ip_lan: text('ip_lan'),                                    
  ip_tailscale: text('ip_tailscale'),                        
  cpu_model: text('cpu_model'),                              
  ram_gb: integer('ram_gb'),                                 
  status: text('status').default('offline'),                 // 'online', 'offline'
  last_seen: text('last_seen'),                              // ISO 8601 datetime
  created_at: text('created_at').default(sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`),
});

// 7. Tabla de Sesiones Activas (Snapshot de Heartbeat)
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  tenant_id: text('tenant_id').default('default').references(() => tenants.id, { onDelete: 'cascade' }),
  server_id: text('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),                      
  session_id: integer('session_id'),                         
  state: text('state').default('Active'),                    // 'Active', 'Idle', 'Disconnected'
  logon_time: text('logon_time'),                            
  source_ip: text('source_ip'),
  idle_time: text('idle_time'),                              
  full_name: text('full_name'),                              
  updated_at: text('updated_at').default(sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`),
}, (table) => [
  unique('sessions_server_user_session_unique').on(table.server_id, table.username, table.session_id),
  index('sessions_tenant_id_server_id_idx').on(table.tenant_id, table.server_id),
]);

// 8. Tabla de Logs de Auditoría RDP (Historial)
export const session_logs = pgTable('session_logs', {
  id: serial('id').primaryKey(),
  tenant_id: text('tenant_id').default('default').references(() => tenants.id, { onDelete: 'cascade' }),
  server_id: text('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),
  event_type: text('event_type').notNull(),                  // 'connect', 'disconnect', 'idle', 'active'
  session_id: integer('session_id'),
  source_ip: text('source_ip'),
  timestamp: text('timestamp').notNull(),                    
  details: text('details'),                                  // JSON o texto extra
  created_at: text('created_at').default(sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`),
}, (table) => [
  index('session_logs_tenant_id_timestamp_idx').on(table.tenant_id, table.timestamp),
]);

// 9. Histórico de Capturas de Pantalla (SaaS Ready)
export const screenshot_metadata = pgTable('screenshot_metadata', {
  id: serial('id').primaryKey(),
  tenant_id: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  server_id: text('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),
  session_id: integer('session_id'),
  filename: text('filename').notNull(),                      // Nombre del archivo físico guardado
  timestamp: text('timestamp').default(sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`), // Fecha captura (ISO 8601)
});

// 10. Tabla de Métricas de Servidor (para Gráficos)
export const server_metrics = pgTable('server_metrics', {
  id: serial('id').primaryKey(),
  tenant_id: text('tenant_id').default('default').references(() => tenants.id, { onDelete: 'cascade' }),
  server_id: text('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  cpu_percent: real('cpu_percent'),
  ram_used_mb: integer('ram_used_mb'),
  ram_total_mb: integer('ram_total_mb'),
  disk_percent: real('disk_percent'),
  active_sessions: integer('active_sessions'),
  timestamp: text('timestamp').default(sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`),
}, (table) => [
  index('server_metrics_server_id_timestamp_idx').on(table.server_id, table.timestamp),
  index('server_metrics_tenant_id_timestamp_idx').on(table.tenant_id, table.timestamp),
]);

// 11. Tabla de Alertas del Sistema
export const alerts = pgTable('alerts', {
  id: serial('id').primaryKey(),
  tenant_id: text('tenant_id').default('default').references(() => tenants.id, { onDelete: 'cascade' }),
  server_id: text('server_id').references(() => servers.id, { onDelete: 'cascade' }),
  alert_type: text('alert_type').notNull(),                  // 'server_down', 'session_idle', 'high_cpu'
  severity: text('severity').default('info'),                // 'info', 'warning', 'critical'
  message: text('message'),
  is_read: integer('is_read').default(0),                    // 0 = No leído, 1 = Leído
  created_at: text('created_at').default(sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`),
}, (table) => [
  index('alerts_tenant_id_is_read_idx').on(table.tenant_id, table.is_read),
]);

// 12. Bitácora de Auditoría Administrativa (Compliance / Seguridad)
export const admin_audit_logs = pgTable('admin_audit_logs', {
  id: serial('id').primaryKey(),
  tenant_id: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),                      // Administrador que hizo la acción
  action: text('action').notNull(),                          // 'login', 'revoke_key', 'delete_server', etc.
  ip_address: text('ip_address'),                            // IP origen del administrador
  details: text('details'),                                  // JSON o texto extra con detalles de la acción
  timestamp: text('timestamp').default(sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`),
});

// 13. Tabla de Registro e Instalación de Licencias (Singleton: ID=1)
export const installation = pgTable('installation', {
  id: integer('id').primaryKey().default(1),                 // singleton: siempre id=1
  install_id: text('install_id').notNull(),                  // UUID generado al arrancar
  license_data: text('license_data'),                        // base64 del payload (o null)
  license_signature: text('license_signature'),              // base64 firma
  last_validated_at: text('last_validated_at'),              // anti-rollback de reloj
  activated_at: text('activated_at'),
  created_at: text('created_at').default(sql`(to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`),
});
