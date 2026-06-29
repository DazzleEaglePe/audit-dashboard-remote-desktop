import Database from 'better-sqlite3';
import { Client } from 'pg';
import path from 'path';
import fs from 'fs';

// Connection details
const SQLITE_DB_PATH = path.resolve(process.env.DATABASE_PATH || './data/audit.db');
const POSTGRES_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/audit';

async function runMigration() {
  console.log('=== STARTING DATABASE MIGRATION (SQLite -> PostgreSQL) ===');
  
  if (!fs.existsSync(SQLITE_DB_PATH)) {
    console.error(`SQLite database not found at: ${SQLITE_DB_PATH}`);
    process.exit(1);
  }
  
  console.log(`Connecting to SQLite: ${SQLITE_DB_PATH}`);
  const sqlite = new Database(SQLITE_DB_PATH);
  
  console.log(`Connecting to PostgreSQL: ${POSTGRES_URL}`);
  const pgClient = new Client({ connectionString: POSTGRES_URL });
  await pgClient.connect();
  
  try {
    // Helper to migrate a table
    const migrateTable = async (
      tableName: string, 
      columns: string[], 
      hasSerialId: boolean = false
    ) => {
      console.log(`Migrating table '${tableName}'...`);
      
      // Fetch rows from SQLite
      let rows: any[] = [];
      try {
        rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
      } catch (err: any) {
        console.warn(`Table '${tableName}' could not be read from SQLite (it may not exist yet). Skipping. Error: ${err.message}`);
        return;
      }
      
      if (rows.length === 0) {
        console.log(`Table '${tableName}' is empty. Skipping.`);
        return;
      }

      console.log(`Found ${rows.length} rows in '${tableName}' to migrate.`);

      // Clear existing records in PG
      await pgClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);

      // Prepare query
      const colNamesStr = columns.map(c => `"${c}"`).join(', ');
      const valPlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const insertQuery = `INSERT INTO "${tableName}" (${colNamesStr}) VALUES (${valPlaceholders})`;

      for (const row of rows) {
        const values = columns.map(c => {
          const val = row[c];
          // Convert SQLite boolean representation (0/1) for integer columns, or return as is
          return val;
        });
        
        await pgClient.query(insertQuery, values);
      }

      console.log(`Successfully migrated ${rows.length} rows to PG table '${tableName}'.`);

      // Reset auto-increment sequence if table has serial primary key
      if (hasSerialId) {
        console.log(`Resetting sequence for '${tableName}'...`);
        await pgClient.query(`
          SELECT setval(
            pg_get_serial_sequence('${tableName}', 'id'), 
            coalesce(max(id), 1)
          ) FROM "${tableName}"
        `);
      }
    };

    // 1. Tenants
    await migrateTable('tenants', [
      'id', 'name', 'status', 'plan', 'max_servers', 'expires_at', 'domain', 'created_at'
    ]);

    // 2. Tenant Settings
    await migrateTable('tenant_settings', [
      'tenant_id', 'alert_emails', 'slack_webhook_url', 'teams_webhook_url', 
      'custom_smtp_host', 'custom_smtp_port', 'custom_smtp_user', 'custom_smtp_pass', 'custom_smtp_from'
    ]);

    // 3. Users
    await migrateTable('users', [
      'id', 'tenant_id', 'username', 'password_hash', 'full_name', 'email', 
      'avatar_url', 'role', 'activation_token', 'activation_token_expires_at', 
      'password_change_required', 'created_at'
    ], true);

    // 4. Servers
    await migrateTable('servers', [
      'id', 'tenant_id', 'hostname', 'ip_lan', 'ip_tailscale', 'cpu_model', 
      'ram_gb', 'status', 'last_seen', 'created_at'
    ]);

    // 5. API Keys
    await migrateTable('api_keys', [
      'id', 'tenant_id', 'name', 'key_hash', 'expires_at', 'created_at', 'last_used_at'
    ], true);

    // 6. Sessions
    await migrateTable('sessions', [
      'id', 'tenant_id', 'server_id', 'username', 'session_id', 'state', 
      'logon_time', 'source_ip', 'idle_time', 'full_name', 'updated_at'
    ], true);

    // 7. Session Logs
    await migrateTable('session_logs', [
      'id', 'tenant_id', 'server_id', 'username', 'event_type', 'session_id', 
      'source_ip', 'timestamp', 'details', 'created_at'
    ], true);

    // 8. Server Metrics
    await migrateTable('server_metrics', [
      'id', 'tenant_id', 'server_id', 'cpu_percent', 'ram_used_mb', 'ram_total_mb', 
      'disk_percent', 'active_sessions', 'timestamp'
    ], true);

    // 9. Alerts
    await migrateTable('alerts', [
      'id', 'tenant_id', 'server_id', 'alert_type', 'severity', 'message', 'is_read', 'created_at'
    ], true);

    // 10. Screenshot Metadata
    await migrateTable('screenshot_metadata', [
      'id', 'tenant_id', 'server_id', 'username', 'session_id', 'filename', 'timestamp'
    ], true);

    // 11. Notifications
    await migrateTable('notifications', [
      'id', 'tenant_id', 'title', 'message', 'type', 'is_read', 'email_sent', 
      'recipient_email', 'created_at'
    ], true);

    // 12. Admin Audit Logs
    await migrateTable('admin_audit_logs', [
      'id', 'tenant_id', 'username', 'action', 'ip_address', 'details', 'timestamp'
    ], true);

    console.log('=== MIGRATION COMPLETED SUCCESSFULLY ===');
  } catch (error) {
    console.error('Migration failed with error:', error);
  } finally {
    sqlite.close();
    await pgClient.end();
  }
}

runMigration();
