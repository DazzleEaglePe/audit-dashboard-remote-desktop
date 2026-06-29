const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const scriptsDir = __dirname;
const privateKeyPath = path.join(scriptsDir, 'private.pem');
const publicKeyPath = path.join(scriptsDir, 'public.pem');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

fs.writeFileSync(privateKeyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
fs.writeFileSync(publicKeyPath,  publicKey.export({ type: 'spki',  format: 'pem' }));

console.log('✅ Claves generadas exitosamente:');
console.log(`   Clave Privada (SECRETA): ${privateKeyPath}`);
console.log(`   Clave Pública (EMBEBER): ${publicKeyPath}`);
console.log('⚠️  NUNCA expongas ni subas la clave privada (private.pem) a ningún repositorio distribuible.');
