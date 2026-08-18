// Turns the x-sync-key header into a users.id.
//
// What the server actually receives is NOT the passphrase. app.js derives
// SHA-256('bbn-sync-v1:' + phrase) in the browser and sends only that, so the
// phrase itself never crosses the wire — that property predates Postgres and is
// kept. Everything below therefore treats the 64-hex sync key as the credential.
//
// Two derived values, for two different jobs (the split 001_init.sql was designed
// around):
//
//   lookup_key  HMAC-SHA256(SYNC_PEPPER, sync_key). Deterministic, so it can be a
//               UNIQUE index and find the row in one hit. The pepper lives in an
//               env var and never in the database, so a stolen dump cannot be
//               walked back to sync keys — which is the whole point of not just
//               storing the sync key directly.
//
//   verifier    scrypt(sync_key, per-user random salt). Slow on purpose. It is
//               the backstop for the case the pepper ALSO leaks: an attacker who
//               can compute lookup_keys still has to break a memory-hard KDF per
//               user to prove a phrase.
//
// scrypt over argon2id (which 001's comment anticipated): argon2 means a native
// npm module in an image that installs nothing today. scrypt is in Node's stdlib,
// is memory-hard, and the stored format is self-describing — so moving to argon2
// later is a verifier rewrite on next login, not a migration.

const crypto = require('crypto');
const { promisify } = require('util');
const db = require('./db');

const scrypt = promisify(crypto.scrypt);

const PEPPER = process.env.SYNC_PEPPER || '';

const KEY_RE = /^[0-9a-f]{64}$/;

// N=16384 r=8 p=1 is the classic "interactive" scrypt point: ~16MB and ~60-100ms
// on the container this runs in. Encoded into every verifier so these numbers can
// be raised later without invalidating existing users.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

// Verifying costs ~80ms, and a sync PUT fires on a 2s debounce while someone is
// typing. Without this cache every keystroke-ish save would pay for a KDF whose
// answer has not changed. The server is one long-lived container (Railway), so an
// in-process cache is real; on a serverless host it would simply never hit, which
// is correct-but-slow rather than wrong.
const VERIFY_TTL_MS = 10 * 60 * 1000;
const VERIFY_MAX    = 5000;
const verified = new Map();   // lookupHex -> { userId, at }

function cacheGet(hex) {
  const hit = verified.get(hex);
  if (!hit) return null;
  if (Date.now() - hit.at > VERIFY_TTL_MS) { verified.delete(hex); return null; }
  return hit.userId;
}

function cacheSet(hex, userId) {
  // Map iterates in insertion order, so the first key is the oldest. Bounded
  // rather than unbounded because this is keyed by attacker-supplied input.
  if (verified.size >= VERIFY_MAX) verified.delete(verified.keys().next().value);
  verified.set(hex, { userId, at: Date.now() });
}

function lookupKey(syncKey) {
  return crypto.createHmac('sha256', PEPPER).update(syncKey, 'utf8').digest();
}

async function makeVerifier(syncKey) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(syncKey, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function checkVerifier(syncKey, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const want = Buffer.from(hashB64, 'base64');
  if (!salt.length || !want.length) return false;
  const got = await scrypt(syncKey, salt, want.length, { N: Number(N), r: Number(r), p: Number(p) });
  // Lengths are equal by construction above, so timingSafeEqual cannot throw here.
  return crypto.timingSafeEqual(got, want);
}

class AuthError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Resolves the header to a user id, creating the user on first sight.
//
// There is no separate sign-up: a passphrase nobody has used yet simply becomes an
// account. That is the behaviour /sync already had with the KV store, and keeping
// it means no new UI and no way to get locked out of your own notes by typing the
// phrase before "registering".
async function resolveUser(syncKeyHeader) {
  if (!PEPPER) throw new AuthError(503, 'sync not configured — SYNC_PEPPER is unset');
  if (!db.isConfigured()) throw new AuthError(503, 'sync not configured — no DATABASE_URL');

  const syncKey = String(syncKeyHeader || '');
  if (!KEY_RE.test(syncKey)) throw new AuthError(400, 'bad key');

  const lk  = lookupKey(syncKey);
  const hex = lk.toString('hex');

  const cached = cacheGet(hex);
  if (cached) return cached;

  const found = await db.query('SELECT id, verifier FROM users WHERE lookup_key = $1', [lk]);

  if (found.rowCount) {
    const { id, verifier } = found.rows[0];
    if (!(await checkVerifier(syncKey, verifier))) {
      // Only reachable if two different sync keys HMAC to the same lookup_key, or
      // the pepper changed under an existing database. Refuse rather than hand
      // back someone else's notes.
      throw new AuthError(403, 'key rejected');
    }
    cacheSet(hex, id);
    // Fire-and-forget: last_seen_at is diagnostics, not something a sync should
    // wait on or fail over.
    db.query('UPDATE users SET last_seen_at = now() WHERE id = $1', [id]).catch(() => {});
    return id;
  }

  const verifier = await makeVerifier(syncKey);
  const created = await db.query(
    `INSERT INTO users (lookup_key, verifier, last_seen_at)
     VALUES ($1, $2, now())
     ON CONFLICT (lookup_key) DO NOTHING
     RETURNING id`,
    [lk, verifier]
  );

  if (created.rowCount) {
    cacheSet(hex, created.rows[0].id);
    return created.rows[0].id;
  }

  // DO NOTHING fired: another request created this same user between our SELECT
  // and our INSERT. The row now exists with THEIR verifier, so re-read and verify
  // against it rather than assuming ours applies.
  const race = await db.query('SELECT id, verifier FROM users WHERE lookup_key = $1', [lk]);
  if (!race.rowCount) throw new AuthError(500, 'could not create user');
  if (!(await checkVerifier(syncKey, race.rows[0].verifier))) throw new AuthError(403, 'key rejected');
  cacheSet(hex, race.rows[0].id);
  return race.rows[0].id;
}

module.exports = { resolveUser, AuthError, lookupKey, makeVerifier, checkVerifier, KEY_RE };
