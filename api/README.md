# api/ — Vercel serverless functions

Two optional, stateless-by-default endpoints. **The app is fully functional without
them** — when no KV store is attached they return `503` and the client silently stays
local-only. Both are backed by the **same** Vercel KV / Upstash Redis store, reached
over its REST API using whichever env-var naming Vercel injects:

```
KV_REST_API_URL   ||  UPSTASH_REDIS_REST_URL
KV_REST_API_TOKEN ||  UPSTASH_REDIS_REST_TOKEN
```

Each file is a single `module.exports = async (req, res) => {…}` handler (Vercel's
Node function signature). A tiny `kv(command)` helper POSTs a Redis command array to
the REST endpoint. **These do not run on the static local server** — test them against
`vercel dev` or the deployed site (see `AGENTS.md → Gotchas #4`).

---

## `sync.js` — cross-device recents + prefs sync

One KV blob per passphrase. **The passphrase never leaves the browser** — the client
sends `SHA-256(passphrase)` as the `x-sync-key` header; that hash keys the store
(`bbn:<hash>`). The server never sees the raw phrase.

| | |
|---|---|
| **Auth** | `x-sync-key` header must match `/^[0-9a-f]{64}$/` (a SHA-256 hex digest), else `400`. |
| **Store key** | `bbn:<key>` |
| **`GET`** | Returns `{ data: <blob>|null }` — the stored `{recents, prefs, updatedAt}` or `null`. |
| **`PUT` / `POST`** | Body `{ recents, prefs }`. `recents` must be an array of ≤ `MAX_RECENTS` (60) → else `400`. Serialized blob must be ≤ `MAX_BYTES` (400 000) → else `413`. Stores `{recents, prefs, updatedAt: Date.now()}`, returns `{ ok: true }`. |
| **Other methods** | `405` with `Allow: GET, PUT`. |
| **No KV configured** | `503` `sync not configured`. |
| **KV error** | `502` `kv unavailable`. |
| **Caching** | `Cache-Control: no-store` (always fresh). |

The pure merge logic that consumes this endpoint (`mergeRecents`, `groupByFolder`)
lives in `app.js` and **is** unit-tested — see [`../tests/INDEX.md`](../tests/INDEX.md).

---

## `img.js` — pasted-image store

Notes live in the URL and image bytes can't fit there, so pasted/dropped images are
**compressed client-side**, uploaded here, and referenced by a short id. The markdown
only ever stores the `/api/img?id=…` URL, never the bytes.

| | |
|---|---|
| **`POST`** | Body `{ type, data }`. `type` ∈ `{image/jpeg, png, webp, gif}`; `data` = base64 string ≤ `MAX_B64` (500 000, ~375 KB) → else `400`/`413`. Stores `img:<id>` and returns `{ id }` (random 10-char base36). |
| **`GET`** | `?id=` must match `/^[a-z0-9]{8,16}$/` → else `400`. Returns the raw bytes with the stored `Content-Type` and `Cache-Control: public, max-age=31536000, immutable`; `404` if unknown. |
| **Other methods** | `405` with `Allow: GET, POST`. |
| **No KV configured** | `503` `image store not configured`. |
| **KV error** | `502` `kv unavailable`. |

---

## Conventions

- **Fail soft.** Missing KV → `503`, never a crash; the client is built to degrade.
- **Validate every input** against a strict regex / allow-list before touching KV
  (keys, ids, mime types, sizes) — these are public, unauthenticated endpoints.
- **`vercel.json`** rewrites everything *except* `/api/` to `index.html`, so these
  routes are reachable while the rest of the site is an SPA shell.
- One-time KV setup (Upstash Redis on the free tier) is documented in the root
  `README.md → Enabling cross-device sync`.
