import fs from 'fs';
import path from 'path';
import { eq, and } from 'drizzle-orm';

// 1. Parse .env manually for absolute reliability
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = value;
      }
    }
  }
}

import { getDrizzleDb } from '../src/lib/db';
import { tenant_settings, alerts as alertsTable, notifications as notificationsTable, servers as serversTable } from '../src/db/schema';

const { startBackgroundWorkers } = require('../src/lib/workers');

async function runTests() {
  console.log('=== STARTING EMAIL ALERT PIPELINE TEST ===');
  
  const db = getDrizzleDb();
  const testTenantId = 'tenant-a';
  const testEmails = 'alertas-test-pipeline@empresa.com';
  const testServerId = 'srv-test-pipeline-1';

  // Backup current setting if any
  const currentSettings = await db.select()
    .from(tenant_settings)
    .where(eq(tenant_settings.tenant_id, testTenantId));
  const backupEmails = currentSettings[0]?.alert_emails ?? null;
  console.log(`Backing up alert_emails for ${testTenantId}: "${backupEmails}"`);

  // Clear existing notifications for this tenant to have a clean test state
  await db.delete(notificationsTable).where(eq(notificationsTable.tenant_id, testTenantId));

  try {
    // Setup test server to prevent foreign key violation
    await db.insert(serversTable).values({
      id: testServerId,
      tenant_id: testTenantId,
      hostname: testServerId,
      status: 'online',
    }).onConflictDoNothing();

    // Setup test tenant settings
    await db.insert(tenant_settings)
      .values({ tenant_id: testTenantId, alert_emails: testEmails })
      .onConflictDoUpdate({
        target: tenant_settings.tenant_id,
        set: { alert_emails: testEmails }
      });

    console.log('Starting workers to initialize lastAlertId baseline...');
    await startBackgroundWorkers();
    
    // Wait 2 seconds for baseline query to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test Case 1: Critical alert generates an email notification
    console.log('\n--- Test 1: Critical alert (server_down) enqueues email ---');
    
    // Insert a critical alert
    const criticalAlertResult = await db.insert(alertsTable).values({
      tenant_id: testTenantId,
      server_id: testServerId,
      alert_type: 'server_down',
      severity: 'critical',
      message: 'Servidor srv-test-pipeline-1 sin respuesta',
    }).returning({ id: alertsTable.id });
    
    const criticalAlertId = criticalAlertResult[0].id;
    console.log(`Created critical alert ID: ${criticalAlertId}`);

    console.log('Waiting 16 seconds for loop to process alert...');
    await new Promise(resolve => setTimeout(resolve, 16000));
    
    // Check if notification was enqueued
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.tenant_id, testTenantId));
    
    console.log(`Found ${notifications.length} notifications:`, notifications.map(n => ({
      title: n.title,
      email_sent: n.email_sent,
      recipient: n.recipient_email
    })));

    const emailNotif = notifications.find(n => n.type === 'alert');
    if (!emailNotif) {
      throw new Error('Test 1 failed: No email notification was queued for the critical alert');
    }
    if (emailNotif.recipient_email !== testEmails) {
      throw new Error(`Test 1 failed: Recipient email "${emailNotif.recipient_email}" does not match "${testEmails}"`);
    }
    if (emailNotif.email_sent !== 0) {
      throw new Error(`Test 1 failed: email_sent should be 0 (pending), got: ${emailNotif.email_sent}`);
    }
    console.log('✅ Test 1 Passed!');

    // Test Case 2: Warning alert does NOT generate an email notification
    console.log('\n--- Test 2: Warning alert (high_cpu) does NOT enqueue email ---');
    // Clear notifications again
    await db.delete(notificationsTable).where(eq(notificationsTable.tenant_id, testTenantId));
    
    // Insert a warning alert
    const warningAlertResult = await db.insert(alertsTable).values({
      tenant_id: testTenantId,
      server_id: testServerId,
      alert_type: 'high_cpu',
      severity: 'warning',
      message: 'CPU usage is at 95%',
    }).returning({ id: alertsTable.id });
    
    console.log(`Created warning alert ID: ${warningAlertResult[0].id}`);
    
    console.log('Waiting 16 seconds for loop to process warning alert...');
    await new Promise(resolve => setTimeout(resolve, 16000));
    
    const warningNotifications = await db.select()
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.tenant_id, testTenantId),
        eq(notificationsTable.type, 'alert')
      ));
      
    console.log(`Warning alert notifications found: ${warningNotifications.length}`);
    if (warningNotifications.length !== 0) {
      throw new Error('Test 2 failed: Warning alert should not queue email notifications');
    }
    console.log('✅ Test 2 Passed!');

    console.log('\n=========================================');
    console.log(' 🎉 ALL EMAIL ALERT PIPELINE TESTS PASSED! ');
    console.log('=========================================');
  } catch (testErr) {
    console.error('❌ Error during test execution:', testErr);
    throw testErr;
  } finally {
    // Delete the test server
    console.log(`Cleaning up test server: ${testServerId}`);
    await db.delete(serversTable).where(eq(serversTable.id, testServerId));

    // Restore backup
    console.log(`Restoring backup alert_emails for ${testTenantId}: "${backupEmails}"`);
    await db.insert(tenant_settings)
      .values({ tenant_id: testTenantId, alert_emails: backupEmails })
      .onConflictDoUpdate({
        target: tenant_settings.tenant_id,
        set: { alert_emails: backupEmails }
      });
      
    // Exit process since setintervals in startBackgroundWorkers will keep it alive
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
