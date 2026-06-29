require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const { Client } = require('pg');

const PORT = process.env.PORT || 4000;
const BASE_URL = `http://localhost:${PORT}`;
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || "35ebbc29d4791338ab3a054a1a364be1dbb4d0eb8d799042c16198f395726210";

let serverProcess;

function startServer() {
  return new Promise((resolve, reject) => {
    console.log('[TEST] Starting license server...');
    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: 'pipe',
      env: process.env
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[SERVER STDOUT] ${output.trim()}`);
      if (output.includes('License server en')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[SERVER STDERR] ${data.toString().trim()}`);
    });

    serverProcess.on('error', (err) => {
      reject(err);
    });

    // Timeout fallback after 8 seconds
    setTimeout(() => {
      resolve();
    }, 8000);
  });
}

async function runTests() {
  let failed = false;
  const assertEqual = (actual, expected, msg) => {
    if (actual !== expected) {
      console.error(`❌ FAIL: ${msg} (Expected ${expected}, got ${actual})`);
      failed = true;
    } else {
      console.log(`✅ PASS: ${msg}`);
    }
  };

  try {
    // ── Test 1: GET /api/admin/keys without token → 401 ──
    const res1 = await fetch(`${BASE_URL}/api/admin/keys`);
    assertEqual(res1.status, 401, 'Request admin keys without authorization token returns 401');

    // ── Test 2: POST /api/admin/keys without token → 401 ──
    const res2 = await fetch(`${BASE_URL}/api/admin/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName: 'Test Corp', maxServers: 10 })
    });
    assertEqual(res2.status, 401, 'Create key without authorization token returns 401');

    // ── Test 3: POST /api/admin/keys with token → 201 ──
    const res3 = await fetch(`${BASE_URL}/api/admin/keys`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      },
      body: JSON.stringify({ 
        customerName: 'Cliente Test Limit 1', 
        maxServers: 10,
        maxActivations: 1,
        expiresDays: 30,
        plan: 'standard',
        features: ['alerts', 'logs']
      })
    });
    assertEqual(res3.status, 201, 'Create key with admin authorization token returns 201');
    const keyData = await res3.json();
    const activationKey = keyData.key;
    console.log(`[TEST] Generated activation key: ${activationKey}`);

    // ── Test 4: Activate key first time → 200 ──
    const installId1 = 'install-uuid-1111-1111';
    const res4 = await fetch(`${BASE_URL}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activationKey, installId: installId1 })
    });
    assertEqual(res4.status, 200, 'First activation on Install-ID 1 returns 200');
    const license1 = await res4.json();
    assertEqual(typeof license1.data, 'string', 'License signature data is a base64 string');
    assertEqual(typeof license1.signature, 'string', 'License signature is a base64 string');

    // ── Test 5: Double activation on different Install-ID (limit 1) → 409 Conflict ──
    const installId2 = 'install-uuid-2222-2222';
    const res5 = await fetch(`${BASE_URL}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activationKey, installId: installId2 })
    });
    assertEqual(res5.status, 409, 'Double activation on different Install-ID with max_activations:1 returns 409');
    const errRes5 = await res5.json();
    assertEqual(errRes5.error.includes('ya fue activada'), true, 'Double activation response contains collision message');

    // ── Test 6: Reissue license for new Install-ID → 200 ──
    const res6 = await fetch(`${BASE_URL}/api/admin/reissue`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      },
      body: JSON.stringify({ activationKey, newInstallId: installId2 })
    });
    assertEqual(res6.status, 200, 'Reissue license for Install-ID 2 returns 200');
    const license2 = await res6.json();
    assertEqual(typeof license2.data, 'string', 'Reissued license data is returned');

    // ── Test 7: Try activating the old Install-ID after reissue → 409 (since count is now 2) ──
    const res7 = await fetch(`${BASE_URL}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activationKey, installId: installId1 })
    });
    assertEqual(res7.status, 409, 'Activating old Install-ID 1 after reissue is rejected with 409');

    // ── Test 8: Revoke Key → 200 ──
    const res8 = await fetch(`${BASE_URL}/api/admin/revoke`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      },
      body: JSON.stringify({ activationKey })
    });
    assertEqual(res8.status, 200, 'Revoke key returns 200');

    // ── Test 9: Try activating a revoked key → 403 Forbidden ──
    const res9 = await fetch(`${BASE_URL}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activationKey, installId: installId2 })
    });
    assertEqual(res9.status, 403, 'Activating revoked key returns 403');

  } catch (err) {
    console.error('[TEST] Unhandled error during tests:', err);
    failed = true;
  }

  return !failed;
}

async function cleanupDb() {
  console.log('[TEST] Cleaning up test keys from Postgres database...');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    // Delete any activation key prefixed or created for testing
    await client.query("DELETE FROM activation_keys WHERE customer_name = 'Cliente Test Limit 1'");
    console.log('[TEST] Database cleaned successfully.');
  } catch (err) {
    console.error('[TEST] Database cleanup failed:', err);
  } finally {
    await client.end();
  }
}

async function run() {
  try {
    await startServer();
    console.log('[TEST] Server is up! Running test suite...');
    const ok = await runTests();
    
    // Shutdown server
    if (serverProcess) {
      console.log('[TEST] Stopping license server...');
      serverProcess.kill();
    }

    await cleanupDb();

    if (ok) {
      console.log('\n⭐ ALL TESTS COMPLETED SUCCESSFULLY! ⭐\n');
      process.exit(0);
    } else {
      console.error('\n❌ SOME TESTS FAILED! ❌\n');
      process.exit(1);
    }
  } catch (err) {
    console.error('[TEST] Critical error in test script:', err);
    if (serverProcess) serverProcess.kill();
    process.exit(1);
  }
}

run();
