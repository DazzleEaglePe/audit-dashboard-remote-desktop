const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:eca-postgres-secure-pass-2026@localhost:5433/audit",
});

async function main() {
  try {
    await client.connect();
    console.log("Connection successful!");
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public';");
    console.log("Tables in database:", res.rows.map(r => r.table_name));
    await client.end();
  } catch (err) {
    console.error("Connection failed! Error:", err);
  }
}

main();
