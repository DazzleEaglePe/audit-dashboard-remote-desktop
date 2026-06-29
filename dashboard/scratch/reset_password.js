const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const client = new Client({
  connectionString: 'postgres://postgres:eca-postgres-secure-pass-2026@localhost:5433/audit'
});

client.connect().then(async () => {
  const hash = bcrypt.hashSync('superadmin123', 10);
  await client.query('UPDATE users SET password_hash = $1, password_change_required = 1 WHERE username = $2', [hash, 'superadmin']);
  console.log('Password of superadmin successfully reset to: superadmin123');
  await client.end();
}).catch(err => {
  console.error(err);
});
