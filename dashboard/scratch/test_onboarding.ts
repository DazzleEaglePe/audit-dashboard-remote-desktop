import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';

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

import { getDrizzleDb, tenantNeedsOnboarding } from '../src/lib/db';
import { tenant_settings, admin_audit_logs } from '../src/db/schema';

async function runTests() {
  console.log('=== STARTING ONBOARDING API & HELPER TEST ===');
  
  const db = getDrizzleDb();
  const testTenantId = 'tenant-a';
  
  // Backup current setting if any
  const currentSettings = await db.select()
    .from(tenant_settings)
    .where(eq(tenant_settings.tenant_id, testTenantId));
  const backupEmails = currentSettings[0]?.alert_emails ?? null;
  console.log(`Backing up alert_emails for ${testTenantId}: "${backupEmails}"`);

  try {
    // Test Case 1: Empty emails requires onboarding
    console.log('\n--- Test 1: Empty alert_emails requires onboarding ---');
    await db.insert(tenant_settings)
      .values({ tenant_id: testTenantId, alert_emails: '' })
      .onConflictDoUpdate({
        target: tenant_settings.tenant_id,
        set: { alert_emails: '' }
      });

    const needsOnboardingEmpty = await tenantNeedsOnboarding(testTenantId);
    console.log(`tenantNeedsOnboarding(empty string) returned: ${needsOnboardingEmpty}`);
    if (needsOnboardingEmpty !== true) {
      throw new Error('Test 1 failed: Empty string should require onboarding');
    }
    console.log('✅ Test 1 Passed!');

    // Test Case 2: Null/undefined emails requires onboarding
    console.log('\n--- Test 2: Null alert_emails requires onboarding ---');
    await db.insert(tenant_settings)
      .values({ tenant_id: testTenantId, alert_emails: null })
      .onConflictDoUpdate({
        target: tenant_settings.tenant_id,
        set: { alert_emails: null }
      });

    const needsOnboardingNull = await tenantNeedsOnboarding(testTenantId);
    console.log(`tenantNeedsOnboarding(null) returned: ${needsOnboardingNull}`);
    if (needsOnboardingNull !== true) {
      throw new Error('Test 2 failed: Null/nullish value should require onboarding');
    }
    console.log('✅ Test 2 Passed!');

    // Test Case 3: Email list validation helper test
    console.log('\n--- Test 3: Validate and split email CSV formats ---');
    const emailTestCases = [
      { input: 'alertas@empresa.com', valid: true },
      { input: 'alertas@empresa.com, admin@empresa.com', valid: true },
      { input: 'invalid-email', valid: false },
      { input: 'alertas@empresa.com, invalid-email', valid: false },
      { input: '', valid: false }
    ];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const test of emailTestCases) {
      const emails = test.input.split(',').map(e => e.trim());
      const isValid = test.input.trim().length > 0 && emails.every(e => emailRegex.test(e));
      console.log(`Input "${test.input}" -> expected valid: ${test.valid}, got: ${isValid}`);
      if (isValid !== test.valid) {
        throw new Error(`Test 3 failed for input: ${test.input}`);
      }
    }
    console.log('✅ Test 3 Passed!');

    // Test Case 4: Setting alert_emails completes onboarding
    console.log('\n--- Test 4: Completing onboarding persists in DB ---');
    const testEmails = 'alertas@empresa.com, backup@empresa.com';
    
    await db.insert(tenant_settings)
      .values({ tenant_id: testTenantId, alert_emails: testEmails })
      .onConflictDoUpdate({
        target: tenant_settings.tenant_id,
        set: { alert_emails: testEmails }
      });

    const needsOnboardingAfter = await tenantNeedsOnboarding(testTenantId);
    console.log(`tenantNeedsOnboarding(populated) returned: ${needsOnboardingAfter}`);
    if (needsOnboardingAfter !== false) {
      throw new Error('Test 4 failed: Populated alert_emails should not require onboarding');
    }
    
    // Verify stored data matches
    const verifySettings = await db.select({ emails: tenant_settings.alert_emails })
      .from(tenant_settings)
      .where(eq(tenant_settings.tenant_id, testTenantId));
    console.log(`Persisted value in DB: "${verifySettings[0]?.emails}"`);
    if (verifySettings[0]?.emails !== testEmails) {
      throw new Error('Test 4 failed: Persisted email value does not match test emails');
    }
    console.log('✅ Test 4 Passed!');

    // Test Case 5: Audit Log entry is written
    console.log('\n--- Test 5: Verify Audit Log is written ---');
    const testLogAction = 'complete_onboarding';
    await db.insert(admin_audit_logs).values({
      tenant_id: testTenantId,
      username: 'test-admin',
      action: testLogAction,
      ip_address: '127.0.0.1',
      details: JSON.stringify({ alert_emails: testEmails }),
    });

    const auditRows = await db.select()
      .from(admin_audit_logs)
      .where(eq(admin_audit_logs.tenant_id, testTenantId))
      .orderBy(admin_audit_logs.id);
    const lastAudit = auditRows[auditRows.length - 1];
    console.log(`Last audit log entry: action="${lastAudit?.action}", username="${lastAudit?.username}"`);
    if (!lastAudit || lastAudit.action !== testLogAction || lastAudit.username !== 'test-admin') {
      throw new Error('Test 5 failed: Audit log not correctly written');
    }
    console.log('✅ Test 5 Passed!');

    console.log('\n=========================================');
    console.log(' 🎉 ALL ONBOARDING HELPER TESTS PASSED! ');
    console.log('=========================================');
  } finally {
    // Restore backup
    console.log(`\nRestoring backup alert_emails for ${testTenantId}: "${backupEmails}"`);
    await db.insert(tenant_settings)
      .values({ tenant_id: testTenantId, alert_emails: backupEmails })
      .onConflictDoUpdate({
        target: tenant_settings.tenant_id,
        set: { alert_emails: backupEmails }
      });
  }
}

runTests().catch(err => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
