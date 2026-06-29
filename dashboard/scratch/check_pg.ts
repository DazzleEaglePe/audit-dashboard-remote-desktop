import { Client } from 'pg';

const connectionString = process.argv[2] || process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/audit";
console.log('Testing PG connection to:', connectionString.replace(/:[^:@]+@/, ':***@'));

const client = new Client({ connectionString });

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected successfully!');
    const res = await client.query('SELECT version();');
    console.log('Version info:', res.rows[0]);
  } catch (err) {
    console.error('❌ Connection failed:', err);
  } finally {
    await client.end();
  }
}

run();
