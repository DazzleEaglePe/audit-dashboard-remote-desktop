const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgres://postgres:eca-postgres-secure-pass-2026@localhost:5433/audit'
});
client.connect().then(async () => {
  const res = await client.query('SELECT username, role, tenant_id FROM users');
  console.log('List of users in PostgreSQL database:', res.rows);
  await client.end();
}).catch(err => {
  console.error('Error connecting to database:', err);
});
