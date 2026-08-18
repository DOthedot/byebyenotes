// Postgres connection, shared by every handler that needs one.
//
// This is the first module in the repo with a runtime dependency (`pg`). It is
// worth it: the KV store held all of a user's notes in ONE 400KB value, so a
// wallpaper competed for budget with notes, and a delete could not be expressed
// at all (see api/sync.js). Rows fix both.
//
// Railway gives two addresses. DATABASE_URL resolves only inside Railway's
// private network — no TLS, no egress cost, sub-millisecond. DATABASE_PUBLIC_URL
// goes out through a TCP proxy with a self-signed cert, and is what a laptop or a
// non-Railway host has to use. Prefer the internal one and fall back, rather than
// making every deployment set the right one of two names.

const { Pool } = require('pg');

const URL_STR = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL || '';

let pool = null;

// Railway's proxy serves a self-signed certificate (its own SSL_CERT_DAYS var
// gives it away), so verification has to be off there. Inside the private network
// there is no TLS terminator at all and asking for SSL just fails the handshake.
function sslFor(connectionString) {
  try {
    if (new URL(connectionString).hostname.endsWith('.railway.internal')) return false;
  } catch (e) { /* unparseable — fall through to the safe default */ }
  return { rejectUnauthorized: false };
}

function getPool() {
  if (pool) return pool;
  if (!URL_STR) return null;
  pool = new Pool({
    connectionString: URL_STR,
    ssl: sslFor(URL_STR),
    // Railway's starter Postgres allows ~100 connections and this app runs as a
    // single long-lived container, so a small pool is plenty. Keeping it low also
    // means a query storm queues instead of exhausting the server for everything
    // else pointed at the same database.
    max: 8,
    idleTimeoutMillis: 30000,
    // Fail a request rather than hanging the browser's sync forever if the
    // database is unreachable — the client shows "sync failed" and retries.
    connectionTimeoutMillis: 5000,
  });
  // A pool that throws on an idle client's error takes the whole process down.
  // Logging is enough: pg discards the bad client and the next checkout is fine.
  pool.on('error', (err) => console.error('pg idle client error:', err.message));
  return pool;
}

function isConfigured() {
  return !!URL_STR;
}

async function query(text, params) {
  const p = getPool();
  if (!p) throw new Error('database not configured');
  return p.query(text, params);
}

// Runs fn with a single client inside BEGIN/COMMIT. A sync PUT writes notes,
// folders and prefs together; applying half of that would leave the client's view
// and the database disagreeing with no way to notice.
async function transaction(fn) {
  const p = getPool();
  if (!p) throw new Error('database not configured');
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (err) { /* connection already gone */ }
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { getPool, isConfigured, query, transaction };
