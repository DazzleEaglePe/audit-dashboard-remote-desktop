import { 
  getDrizzleDb,
  insertAlert,
  checkServerTimeouts,
  cleanOldMetrics,
  cleanOldLogs
} from "./db";
import { 
  alerts as alertsTable, 
  tenant_settings as settingsTable, 
  notifications as notificationsTable, 
  tenants as tenantsTable, 
  users as usersTable
} from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import { decrypt } from "./encryption";

// 1. Dispatch MS Teams / Slack Alert Webhooks
async function dispatchAlertWebhooks(alert: typeof alertsTable.$inferSelect) {
  try {
    if (!alert.tenant_id) return;
    const db = getDrizzleDb();
    const settingsList = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.tenant_id, alert.tenant_id));
      
    const settings = settingsList[0];
    if (!settings) return;

    // Slack Integration
    if (settings.slack_webhook_url) {
      try {
        const payload = {
          text: `🚨 *Nueva Alerta de Auditoría ECA*\n*Servidor:* \`${alert.server_id}\`\n*Tipo:* \`${alert.alert_type}\`\n*Gravedad:* \`${alert.severity}\`\n*Mensaje:* ${alert.message}`
        };
        const res = await fetch(settings.slack_webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          console.error(`[WORKERS] Slack webhook response error: ${res.statusText}`);
        }
      } catch (err) {
        console.error(`[WORKERS] Error sending Slack alert for tenant ${alert.tenant_id}:`, err);
      }
    }

    // MS Teams Integration
    if (settings.teams_webhook_url) {
      try {
        const color = alert.severity === 'critical' ? "d60000" : "f5a623";
        const payload = {
          "@type": "MessageCard",
          "@context": "http://schema.org/extensions",
          "themeColor": color,
          "summary": "Nueva Alerta - Auditoría ECA",
          "sections": [{
            "activityTitle": "🚨 Nueva Alerta - Auditoría ECA",
            "activitySubtitle": `Servidor: ${alert.server_id}`,
            "facts": [
              { "name": "Tipo", "value": alert.alert_type },
              { "name": "Gravedad", "value": alert.severity },
              { "name": "Mensaje", "value": alert.message }
            ],
            "markdown": true
          }]
        };
        const res = await fetch(settings.teams_webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          console.error(`[WORKERS] MS Teams webhook response error: ${res.statusText}`);
        }
      } catch (err) {
        console.error(`[WORKERS] Error sending MS Teams alert for tenant ${alert.tenant_id}:`, err);
      }
    }
  } catch (err) {
    console.error("[WORKERS] Error in dispatchAlertWebhooks:", err);
  }
}

// 2. SMTP Queue Dispatcher
async function processSmtpQueue() {
  try {
    const db = getDrizzleDb();
    const pendingNotifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.email_sent, 0));
      
    if (pendingNotifications.length === 0) return;

    console.log(`[SMTP WORKER] Processing ${pendingNotifications.length} pending emails...`);

    for (const notif of pendingNotifications) {
      try {
        const settingsList = await db.select()
          .from(settingsTable)
          .where(eq(settingsTable.tenant_id, notif.tenant_id));
        const settings = settingsList[0];

        let host = settings?.custom_smtp_host || process.env.SMTP_HOST;
        let port = settings?.custom_smtp_port || (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587);
        let user = settings?.custom_smtp_user || process.env.SMTP_USER;
        let pass = settings?.custom_smtp_pass ? decrypt(settings.custom_smtp_pass) : process.env.SMTP_PASS;
        let from = settings?.custom_smtp_from || process.env.SMTP_FROM || "no-reply@ecabot.site";

        if (!host || !user || !pass) {
          console.warn(`[SMTP WORKER] No SMTP configuration found for tenant ${notif.tenant_id}. Skipping notification ${notif.id}.`);
          await db.update(notificationsTable)
            .set({ email_sent: 2 })
            .where(eq(notificationsTable.id, notif.id));
          continue;
        }

        // Handle masked passwords saved from UI settings view
        if (pass === '••••••••') {
          if (process.env.SMTP_PASS) {
            pass = process.env.SMTP_PASS;
            user = process.env.SMTP_USER || user;
            host = process.env.SMTP_HOST || host;
            port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : port;
          } else {
            console.error(`[SMTP WORKER] Password was masked and no global SMTP backup found. Skipping notification ${notif.id}.`);
            await db.update(notificationsTable)
              .set({ email_sent: 2 })
              .where(eq(notificationsTable.id, notif.id));
            continue;
          }
        }

        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: {
            user,
            pass,
          },
        });

        await transporter.sendMail({
          from,
          to: notif.recipient_email || "",
          subject: notif.title,
          text: notif.message,
        });

        console.log(`[SMTP WORKER] Email successfully sent to ${notif.recipient_email} for tenant ${notif.tenant_id}`);
        await db.update(notificationsTable)
          .set({ email_sent: 1 })
          .where(eq(notificationsTable.id, notif.id));

      } catch (err: any) {
        console.error(`[SMTP WORKER] Failed to send email for notification ${notif.id}:`, err.message);
        await db.update(notificationsTable)
          .set({ email_sent: 2 })
          .where(eq(notificationsTable.id, notif.id));
      }
    }
  } catch (err) {
    console.error("[SMTP WORKER] Error in processSmtpQueue:", err);
  }
}

// 3. License Expiration Watcher
async function checkLicenseExpirations() {
  try {
    const db = getDrizzleDb();
    const activeTenants = await db.select()
      .from(tenantsTable)
      .where(eq(tenantsTable.status, 'active'));

    console.log(`[LICENSE WATCHER] Checking license expirations for ${activeTenants.length} tenants...`);
    const now = new Date();
    
    for (const tenant of activeTenants) {
      if (!tenant.expires_at) continue;

      const expiryDate = new Date(tenant.expires_at);
      const diffTime = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 7 && diffDays > 0) {
        // Only trigger once in 7 days
        const lastWarnings = await db.select()
          .from(notificationsTable)
          .where(and(
            eq(notificationsTable.tenant_id, tenant.id),
            eq(notificationsTable.type, 'license_expiry'),
            sql`created_at > TO_CHAR(NOW() - (7 * INTERVAL '1 day'), 'YYYY-MM-DD HH24:MI:SS')`
          ));

        if (lastWarnings.length === 0) {
          const adminUsersList = await db.select()
            .from(usersTable)
            .where(and(
              eq(usersTable.tenant_id, tenant.id),
              eq(usersTable.role, 'admin')
            ));

          const adminUser = adminUsersList[0];
          const recipient = adminUser?.email || null;
          
          console.log(`[LICENSE WATCHER] Tenant ${tenant.id} expires in ${diffDays} days. Queueing email notification...`);
          
          await db.insert(notificationsTable)
            .values({
              tenant_id: tenant.id,
              title: "Renovación de Licencia Requerida",
              message: `Estimado Administrador,\n\nTu suscripción a la plataforma de Auditoría ECA para la empresa "${tenant.name}" vencerá en ${diffDays} días (Fecha de expiración: ${expiryDate.toLocaleDateString()}).\n\nPor favor, contacta con soporte para renovar tu suscripción y evitar que tu cuenta sea suspendida.\n\nAtentamente,\nSoporte ECA`,
              type: 'license_expiry',
              email_sent: recipient ? 0 : null,
              recipient_email: recipient,
            });
        }
      }
    }
  } catch (err) {
    console.error("[LICENSE WATCHER] Error in checkLicenseExpirations:", err);
  }
}

// 4. Main Entry point to start the background tasks
export async function startBackgroundWorkers() {
  console.log("[WORKERS] Starting background SaaS workers...");

  let lastAlertId = 0;
  try {
    const db = getDrizzleDb();
    const results = await db.select({ maxId: sql<number | null>`max(id)` }).from(alertsTable);
    const result = results[0];
    lastAlertId = Number(result?.maxId || 0);
    console.log(`[WORKERS] Alert Webhook Dispatcher tracking alerts from ID: ${lastAlertId}`);
  } catch (err) {
    console.error("[WORKERS] Failed to query max alert ID:", err);
  }

  // Job A: Alert webhooks processor (every 15 seconds)
  setInterval(async () => {
    try {
      const db = getDrizzleDb();
      const newAlerts = await db.select()
        .from(alertsTable)
        .where(sql`id > ${lastAlertId}`)
        .orderBy(alertsTable.id);

      for (const alert of newAlerts) {
        if (alert.id > lastAlertId) {
          lastAlertId = alert.id;
        }
        await dispatchAlertWebhooks(alert);
      }
    } catch (err) {
      console.error("[WORKERS] Error in Alert Webhook Loop:", err);
    }
  }, 15000);

  // Job B: SMTP outbound dispatcher (every 30 seconds)
  setInterval(async () => {
    await processSmtpQueue();
  }, 30000);

  // Job C: Server downtime inspector (every 1 minute)
  setInterval(async () => {
    try {
      const staleServers = await checkServerTimeouts(2);
      for (const serverId of staleServers) {
        await insertAlert({
          server_id: serverId,
          alert_type: 'server_down',
          severity: 'critical',
          message: `Servidor ${serverId} sin respuesta (sin heartbeat por >2 min)`,
        });
      }
    } catch (err) {
      console.error("[WORKERS] Error in Server Timeout checker loop:", err);
    }
  }, 60000);

  // Job D: Daily maintenance cleaner & license watcher (run on startup after 5s, then every 24h)
  setTimeout(async () => {
    await checkLicenseExpirations();
    try {
      const metricsRetentionDays = process.env.RETENTION_METRICS_DAYS ? parseInt(process.env.RETENTION_METRICS_DAYS, 10) : 7;
      const logsRetentionDays = process.env.RETENTION_LOGS_DAYS ? parseInt(process.env.RETENTION_LOGS_DAYS, 10) : 90;
      await cleanOldMetrics(metricsRetentionDays);
      await cleanOldLogs(logsRetentionDays);
      console.log(`[WORKERS] Database maintenance completed: Pruned metrics older than ${metricsRetentionDays} days and logs older than ${logsRetentionDays} days.`);
    } catch (err) {
      console.error("[WORKERS] Error running database maintenance on startup:", err);
    }
  }, 5000);

  setInterval(async () => {
    await checkLicenseExpirations();
    try {
      const metricsRetentionDays = process.env.RETENTION_METRICS_DAYS ? parseInt(process.env.RETENTION_METRICS_DAYS, 10) : 7;
      const logsRetentionDays = process.env.RETENTION_LOGS_DAYS ? parseInt(process.env.RETENTION_LOGS_DAYS, 10) : 90;
      await cleanOldMetrics(metricsRetentionDays);
      await cleanOldLogs(logsRetentionDays);
      console.log(`[WORKERS] Daily database maintenance completed.`);
    } catch (err) {
      console.error("[WORKERS] Error running daily database maintenance:", err);
    }
  }, 24 * 60 * 60 * 1000);
}
