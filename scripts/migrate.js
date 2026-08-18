#!/usr/bin/env node
// Applies migrations/*.sql in filename order, once each.
//
// Usage:  node scripts/migrate.js
//
// Connects via DATABASE_PUBLIC_URL (Railway's TCP proxy — the only address
// reachable from a laptop). Inside Railway, DATABASE_URL is used instead.
// No dotenv dependency: .env is parsed here, matching the repo's no-deps style.

const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');

function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;                                  // comments and blanks
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

async function main() {
  loadEnv();

  const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!url || url.includes('<')) {
    console.error(
      'No usable connection string.\n' +
      'Set DATABASE_PUBLIC_URL in .env to the resolved Railway TCP-proxy URL,\n' +
      'e.g. postgresql://postgres:PASS@caboose.proxy.rlwy.net:41234/railway'
    );
    process.exit(1);
  }

  // Railway's Postgres serves a self-signed cert (note SSL_CERT_DAYS in its
  // env), so verification has to be off for the proxy connection.
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text        PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await client.query('SELECT name FROM schema_migrations')).rows.map(r => r.name)
  );

  const dir = path.join(ROOT, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skip  ${file}`);
      continue;
    }
    // Each file wraps itself in BEGIN/COMMIT, so a failure rolls that file back
    // and the bookkeeping row is never written — safe to re-run.
    process.stdout.write(`  apply ${file} ... `);
    await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    console.log('ok');
    ran++;
  }

  console.log(ran ? `\n${ran} migration(s) applied.` : '\nAlready up to date.');
  await client.end();
}

main().catch(err => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
