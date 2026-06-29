require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { pool, initDb } = require('./db');
const { requireAdmin } = require('./auth');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS configuration: restrict to allowed origins if specified (disable wildcard fallback)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ 
  origin: allowedOrigins.length ? allowedOrigins : false 
}));

// Rate limiter for license activation: max 10 attempts per 15 minutes per IP
const activateLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 10,
  message: { error: 'Demasiados intentos de activación. Por favor, intente de nuevo en 15 minutos.' }
});

// Load private key (only from own directory or environment variable)
const privateKeyPem = process.env.LICENSE_PRIVATE_KEY || fs.readFileSync(path.join(__dirname, 'private.pem'), 'utf8');
const PRIVATE_KEY = crypto.createPrivateKey(privateKeyPem);

// Helper function to sign a payload (same algorithm/format as CLI)
function signLicense(payload) {
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = crypto.sign(null, data, PRIVATE_KEY);
  return { 
    data: data.toString('base64'), 
    signature: signature.toString('base64') 
  };
}

// Build license payload
function buildPayload(key, installId) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + key.expires_days);
  return {
    licenseId: crypto.randomUUID(),
    customerName: key.customer_name,
    installId,
    maxServers: key.max_servers,
    plan: key.plan,
    features: key.features ? key.features.split(',').map(s => s.trim()).filter(Boolean) : [],
    issuedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

// ── POST /api/activate (Public, with rate limit) ──
app.post('/api/activate', activateLimiter, async (req, res) => {
  const { activationKey, installId } = req.body;
  if (!activationKey || !installId) {
    return res.status(400).json({ error: 'Faltan activationKey o installId' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // FOR UPDATE: lock the row to prevent race conditions (double activation)
    const { rows } = await client.query(
      'SELECT * FROM activation_keys WHERE key = $1 FOR UPDATE', 
      [activationKey]
    );
    const key = rows[0];

    if (!key) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Clave de activación inválida' });
    }

    if (key.status === 'revoked') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Clave de activación revocada' });
    }

    const sameInstall = key.used_by_install_id === installId;
    
    // If already activated elsewhere and reached maximum activation count
    if (key.used_by_install_id && !sameInstall && key.activation_count >= key.max_activations) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Esta clave ya fue activada en otra instalación. Contacta a soporte.' });
    }

    const payload = buildPayload(key, installId);
    const signed = signLicense(payload);

    // Update activation stats
    await client.query(
      'UPDATE activation_keys SET used_by_install_id = $1, activation_count = activation_count + $2, status = $3 WHERE id = $4',
      [installId, sameInstall ? 0 : 1, 'used', key.id]
    );

    // Store issued license record
    await client.query(
      'INSERT INTO issued_licenses (license_id, activation_key_id, install_id, payload, signature) VALUES ($1, $2, $3, $4, $5)',
      [payload.licenseId, key.id, installId, signed.data, signed.signature]
    );

    await client.query('COMMIT');
    console.log(`[LICENSE-SERVER] Licencia activada para ${payload.customerName} (Install-ID: ${installId})`);
    return res.json(signed);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en /api/activate:', err);
    return res.status(500).json({ error: 'Error interno al activar la licencia' });
  } finally {
    client.release();
  }
});

// ── POST /api/admin/keys (Protected admin route to generate keys) ──
app.post('/api/admin/keys', requireAdmin, async (req, res) => {
  const { customerName, maxServers, plan, features, expiresDays, maxActivations } = req.body;
  if (!customerName || !maxServers) {
    return res.status(400).json({ error: 'Faltan customerName o maxServers' });
  }

  try {
    // Generate clean readable license key format: ECA-XXXX-XXXX-XXXX
    const rand = crypto.randomBytes(9).toString('hex').toUpperCase();
    const key = `ECA-${rand.slice(0, 4)}-${rand.slice(4, 8)}-${rand.slice(8, 12)}`;

    const featuresCsv = Array.isArray(features) ? features.join(',') : (features || '');
    
    const { rows } = await pool.query(
      `INSERT INTO activation_keys (key, customer_name, max_servers, plan, features, expires_days, max_activations)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        key, 
        customerName, 
        parseInt(maxServers, 10), 
        plan || 'standard', 
        featuresCsv, 
        parseInt(expiresDays || 365, 10),
        parseInt(maxActivations || 1, 10)
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating activation key:', err);
    res.status(500).json({ error: 'Error interno al generar la clave de activación' });
  }
});

// ── GET /api/admin/keys (Protected admin route to list keys) ──
app.get('/api/admin/keys', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM activation_keys ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching activation keys:', err);
    res.status(500).json({ error: 'Error interno al listar las claves' });
  }
});

// ── POST /api/admin/revoke (Protected admin route to revoke license keys) ──
app.post('/api/admin/revoke', requireAdmin, async (req, res) => {
  const { activationKey } = req.body;
  if (!activationKey) {
    return res.status(400).json({ error: 'Falta activationKey' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { rows } = await client.query(
      'UPDATE activation_keys SET status = $1 WHERE key = $2 RETURNING id', 
      ['revoked', activationKey]
    );
    const key = rows[0];

    if (!key) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Clave de activación no encontrada' });
    }

    await client.query(
      'UPDATE issued_licenses SET status = $1 WHERE activation_key_id = $2', 
      ['revoked', key.id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: `Clave ${activationKey} y todas sus licencias asociadas revocadas.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error revoking license key:', err);
    res.status(500).json({ error: 'Error interno al revocar la clave de activación' });
  } finally {
    client.release();
  }
});

// ── POST /api/admin/reissue (Protected admin route to reissue license on hardware change) ──
app.post('/api/admin/reissue', requireAdmin, async (req, res) => {
  const { activationKey, newInstallId } = req.body;
  if (!activationKey || !newInstallId) {
    return res.status(400).json({ error: 'Faltan activationKey o newInstallId' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { rows } = await client.query(
      'SELECT * FROM activation_keys WHERE key = $1 FOR UPDATE', 
      [activationKey]
    );
    const key = rows[0];

    if (!key) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Clave de activación no encontrada' });
    }

    if (key.status === 'revoked') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Clave de activación revocada' });
    }

    const payload = buildPayload(key, newInstallId);
    const signed = signLicense(payload);

    // Update activation info mapping to the new install ID
    await client.query(
      'UPDATE activation_keys SET used_by_install_id = $1, activation_count = activation_count + 1 WHERE id = $2',
      [newInstallId, key.id]
    );

    // Mark previous issued licenses under this key as revoked
    await client.query(
      'UPDATE issued_licenses SET status = $1 WHERE activation_key_id = $2', 
      ['revoked', key.id]
    );

    // Insert new valid license
    await client.query(
      'INSERT INTO issued_licenses (license_id, activation_key_id, install_id, payload, signature) VALUES ($1, $2, $3, $4, $5)',
      [payload.licenseId, key.id, newInstallId, signed.data, signed.signature]
    );

    await client.query('COMMIT');
    res.json(signed);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error reissuing license key:', err);
    res.status(500).json({ error: 'Error interno al reemitir la licencia' });
  } finally {
    client.release();
  }
});

// SPA routing: catch-all for any sub-routes of /admin to serve index.html
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

initDb().then(() => {
  app.listen(PORT, () => console.log(`🚀 License server en http://localhost:${PORT}`));
}).catch(err => {
  console.error('No se pudo iniciar la BD del Servidor de Licencias:', err);
  process.exit(1);
});
