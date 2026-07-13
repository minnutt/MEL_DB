const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

async function run() {
  loadDotEnv();
  const sqlPath = path.join(__dirname, 'setup.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'meldb',
    user: process.env.PGUSER || 'stqc',
    password: process.env.PGPASSWORD || 'stqcit@123',
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log('Database schema initialized from setup.sql');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
