const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── 1. Parser mínimo de argumentos --clave valor ─────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[key] = val;
    }
  }
  return args;
}

const a = parseArgs(process.argv);

// ── 2. Validación de entradas obligatorias ───────────────────
const required = ['customer', 'installId', 'maxServers', 'expires'];
if (process.argv.length <= 2 || a.help) {
  console.log(`Uso: node sign-license.js --customer "Empresa XYZ" --installId <uuid> --maxServers 50 --expires 2027-06-21 [--plan enterprise] [--features screenshots,webhooks] [--out license.json]`);
  process.exit(0);
}

for (const r of required) {
  if (!a[r]) {
    console.error(`❌ Falta argumento obligatorio: --${r}`);
    console.error(`Uso: node sign-license.js --customer "Empresa XYZ" --installId <uuid> --maxServers 50 --expires 2027-06-21 [--plan enterprise] [--features screenshots,webhooks] [--out license.json]`);
    process.exit(1);
  }
}

// ── 3. Cargar la clave privada ───────────────────────────────
const scriptsDir = __dirname;
const keyPath = process.env.LICENSE_PRIVATE_KEY_PATH || path.join(scriptsDir, 'private.pem');
if (!fs.existsSync(keyPath)) {
  console.error(`❌ No se encontró la clave privada en ${keyPath}`);
  process.exit(1);
}
const privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath, 'utf8'));

// ── 4. Construir el payload ──────────────────────────────────
// expires: 'YYYY-MM-DD' → ISO al final del día UTC
const expiresAt = new Date(`${a.expires}T23:59:59Z`).toISOString();
if (isNaN(Date.parse(expiresAt))) {
  console.error('❌ --expires inválido. Usa formato YYYY-MM-DD');
  process.exit(1);
}

const payload = {
  licenseId: crypto.randomUUID(),
  customerName: a.customer,
  installId: a.installId,
  maxServers: parseInt(a.maxServers, 10),
  plan: a.plan || 'standard',
  features: a.features ? a.features.split(',').map(s => s.trim()) : [],
  issuedAt: new Date().toISOString(),
  expiresAt,
};

if (isNaN(payload.maxServers) || payload.maxServers < 1) {
  console.error('❌ --maxServers debe ser un entero >= 1');
  process.exit(1);
}

// ── 5. Firmar los BYTES EXACTOS del payload (patrón base64) ───
const data = Buffer.from(JSON.stringify(payload), 'utf8');
const signature = crypto.sign(null, data, privateKey);   // Ed25519 → algoritmo null

const licenseFile = {
  data: data.toString('base64'),
  signature: signature.toString('base64'),
};

// ── 6. Escribir license.json ─────────────────────────────────
const out = a.out || 'license.json';
fs.writeFileSync(out, JSON.stringify(licenseFile, null, 2));

console.log(`✅ Licencia firmada → ${out}`);
console.log(`   Cliente:     ${payload.customerName}`);
console.log(`   Install-ID:  ${payload.installId}`);
console.log(`   maxServers:  ${payload.maxServers}`);
console.log(`   Expira:      ${payload.expiresAt}`);
console.log(`   licenseId:   ${payload.licenseId}`);
