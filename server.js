// Container entrypoint for non-Vercel hosts (Railway, Fly, a plain VPS).
//
// Vercel gives us two things this app relies on that a bare Node server does not:
//   1. static hosting + the SPA rewrite in vercel.json
//   2. an enhanced req/res for api/*.js — req.query, req.body, res.status().json()
//
// Since api/sync.js moved to Postgres this is no longer just an alternative front
// door: it is the front door. Vercel has no route to the Railway private network,
// so the deployment that owns the database owns the app.
//
// This file supplies both, with **no runtime dependencies**, so `api/*.js` stay
// byte-identical and keep working on Vercel unchanged. Deploying here does not
// fork the app; it's the same files behind a different front door.
//
// Requires Node 18+ (api/*.js call global fetch).

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;   // Railway injects PORT

// Mirrors api/img.js's own cap (MAX_B64) with headroom for the JSON envelope;
// without a limit an unbounded POST body would sit in memory until OOM.
const MAX_BODY_BYTES = 6 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.txt':  'text/plain; charset=utf-8',
};

// ── Vercel-compatible res helpers ────────────────────────────────────────────
// api/*.js call res.status(n).json(obj) / .send(body) and res.setHeader(...).
// Node's ServerResponse has setHeader but none of the rest, so add them.
function enhanceRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.hasHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (body) => {
    if (Buffer.isBuffer(body)) return res.end(body);
    if (typeof body === 'object' && body !== null) return res.json(body);
    res.end(body == null ? '' : String(body));
    return res;
  };
  return res;
}

// Vercel pre-parses JSON bodies; do the same, and fail closed on malformed input
// rather than handing a handler a half-parsed object.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);
      const type = String(req.headers['content-type'] || '');
      if (!type.includes('application/json')) return resolve(raw);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(Object.assign(new Error('invalid json'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

// ── Static files ─────────────────────────────────────────────────────────────
// Allowlist, not a denylist. The app's static surface is fixed and tiny, while the
// working directory also holds server.js, package.json and api/*.js — none of which
// Vercel would ever serve. A denylist has to anticipate every way of naming those
// (`/./api/sync.js`, `/..%2Fpackage.json`, …); an allowlist cannot leak a file it
// was never told about. Add new static files here deliberately.
const STATIC_FILES = new Set(['/index.html', '/app.js', '/style.css', '/favicon.ico']);
const STATIC_DIRS  = ['/assets/'];

// Decode and normalize *once*, up front, so every later check sees the same string
// the filesystem will. Checking the raw path first is how `/./api/…` sneaks past an
// `/api/` guard and gets served as source.
function normalizePath(raw) {
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch (e) {
    return null;                       // malformed percent-encoding
  }
  if (decoded.includes('\0')) return null;
  const norm = path.posix.normalize(decoded);
  return norm.startsWith('/') ? norm : '/' + norm;
}

function isServable(pathname) {
  if (STATIC_FILES.has(pathname)) return true;
  return STATIC_DIRS.some(dir => pathname.startsWith(dir) && !pathname.slice(dir.length).includes('/..'));
}

// Belt to the allowlist's braces: resolve and confirm the result really is inside
// ROOT before opening anything.
function resolveSafe(pathname) {
  const abs = path.resolve(ROOT, '.' + pathname);
  return abs === ROOT || abs.startsWith(ROOT + path.sep) ? abs : null;
}

function serveFile(res, abs, { immutable = false } = {}) {
  const ext = path.extname(abs).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  // index.html must never be cached: it's the shell every deploy replaces.
  // Hashed-content assets (images) are safe to cache hard.
  res.setHeader('Cache-Control', immutable
    ? 'public, max-age=31536000, immutable'
    : 'no-cache');
  fs.createReadStream(abs)
    .on('error', () => { res.statusCode = 500; res.end('read error'); })
    .pipe(res);
}

// ── Router ───────────────────────────────────────────────────────────────────
const API = {
  '/api/sync': require('./api/sync.js'),
  '/api/img':  require('./api/img.js'),
  '/api/tiny': require('./api/tiny.js'),
};

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = normalizePath(parsed.pathname || '/');
  if (pathname === null) { res.statusCode = 400; return res.end('bad path'); }

  // Railway/Fly health checks. Reports whether the backing stores are CONFIGURED,
  // deliberately without querying them: a health check that pings Postgres turns a
  // ten-second database blip into a container restart loop.
  if (pathname === '/healthz') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      ok: true,
      db: Boolean(process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL),
      pepper: Boolean(process.env.SYNC_PEPPER),
      kv: Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
    }));
  }

  if (pathname.startsWith('/api/')) {
    const handler = API[pathname];
    enhanceRes(res);
    if (!handler) return res.status(404).json({ error: 'not found' });
    try {
      req.query = parsed.query || {};
      if (req.method !== 'GET' && req.method !== 'HEAD') req.body = await readBody(req);
      return await handler(req, res);
    } catch (e) {
      if (res.headersSent || res.writableEnded) return;
      const code = e && e.statusCode ? e.statusCode : 500;
      return res.status(code).json({ error: code === 500 ? 'server error' : e.message });
    }
  }

  const shell = () => serveFile(res, path.join(ROOT, 'index.html'));

  // Anything outside the allowlist falls through to the shell rather than 404ing —
  // that is vercel.json's rewrite `/((?!api/).*)` → /index.html, and it's what makes
  // /s/<id> tiny links resolve client-side.
  if (!isServable(pathname)) return shell();

  const abs = resolveSafe(pathname);
  if (!abs) return shell();

  fs.stat(abs, (err, stat) => {
    if (err || !stat.isFile()) return shell();
    serveFile(res, abs, { immutable: pathname.startsWith('/assets/') });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const db     = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  const pepper = process.env.SYNC_PEPPER;
  const kv     = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  console.log(`byebyenotes listening on :${PORT}`);
  // Say which half is missing. "sync is broken" with no hint as to which of two
  // env vars is unset is the kind of thing that eats an afternoon.
  console.log(db && pepper
    ? '/api/sync -> Postgres.'
    : `/api/sync returns 503 — missing ${[!db && 'DATABASE_URL', !pepper && 'SYNC_PEPPER'].filter(Boolean).join(' and ')}.`);
  console.log(kv
    ? '/api/img and tiny links -> KV.'
    : 'No KV env vars — pasted images and tiny links return 503 by design.');
});
