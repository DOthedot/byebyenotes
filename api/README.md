# api/ — server endpoints

Optional endpoints. **The app is fully functional without every one of them**: a note
lives in its URL, so with nothing configured the client silently stays local-only and
these return `503`.

They are split across two backing stores, which is the thing to know before editing:

| Handler | Store | Configured by |
|---|---|---|
| `sync.js` | **Postgres** (`users`, `notes`, `folders`, `user_prefs`) | `DATABASE_URL`, `SYNC_PEPPER` |
| `img.js` | Vercel KV / Upstash Redis | `KV_REST_API_URL`, `KV_REST_API_TOKEN` |
| `tiny.js` | Vercel KV / Upstash Redis | same as above |

Each file is a single `module.exports = async (req, res) => {…}` handler (Vercel's Node
function signature). `server.js` reproduces that signature — `req.query`, `req.body`,
`res.status().json()` — so the same files run unchanged on Railway or a plain VPS.

**Postgres has no route from Vercel to Railway's private network**, so the deployment
that owns the database owns `/api/sync`. See `AGENTS.md → Deploying`.

---

## `sync.js` — cross-device notes, folders and prefs

Rows, not a blob. This replaced a single KV value per passphrase, whose two limits
could not be fixed at the storage layer:

- **One 400KB budget for everything.** A 120KB wallpaper took a third of it, and the
  failure mode was a `413` telling the user to delete notes.
- **Deletion could not be expressed.** The blob was a full list, so a deleted note was
  merely *absent* — and absence carries no timestamp. The other device's copy always
  won the merge and the note came back. `deleted_at` carries one; absence doesn't.

**The passphrase never leaves the browser.** The client sends `SHA-256(passphrase)` as
`x-sync-key`; `auth.js` turns that into a `users` row via two derived values:

| | |
|---|---|
| `users.lookup_key` | `HMAC-SHA256(SYNC_PEPPER, sync_key)`. Deterministic, so it can be a UNIQUE index. The pepper lives in an env var and **never in the database**, so a stolen dump can't be walked back to sync keys. |
| `users.verifier` | `scrypt(sync_key, per-user salt)`, format `scrypt$N$r$p$salt$hash`. The backstop if the pepper also leaks. Verified results are cached in-process for 10 min — otherwise every 2-second autosave would pay ~80ms for an answer that hasn't changed. |

There is **no separate sign-up**: an unused passphrase becomes an account on first
sight. That is what `/sync` already did with KV, and it means no new UI and no way to
lock yourself out by typing the phrase before "registering".

### `GET /api/sync[?since=<epoch_ms>]`

```jsonc
{ "data": {
  "notes":        [ { "nid", "blocks", "title", "titlePinned", "folder", "theme", "font", "t", "deleted" } ],
  "deletedNotes": [ /* same shape, tombstones from the last 90 days */ ],
  "folders":      [ { "path", "t", "deleted" } ],
  "prefs":        { /* the open-ended client bag, or null */ },
  "sidebarImage": "data:image/jpeg;base64,…" /* or null */,
  "serverTime":   1700000000000
} }
```

`t` is the row's `updated_at` **on the server's clock**, which is what makes
last-write-wins trustworthy — a device with a wrong clock can no longer win a merge it
should have lost. Bounded at 200 rows per list. `?since=` returns only what changed,
tombstones included; that is what `notes_user_updated_idx` exists for.

**Notes travel as `blocks`, never as the LZ-String hash.** The hash is a URL
serialization of exactly that state; storing it too would mean two copies of one note
that can disagree — and the one in the URL is the one that goes stale. `app.js`
re-derives it on arrival (`wireNoteToSnapshot`).

### `PUT` / `POST /api/sync`

Body: `{ notes, deletedNotes, folders, deletedFolders, prefs, sidebarImage }` — every
field optional. Returns `{ ok: true, ...counts }`.

| Behaviour | Why |
|---|---|
| Upserts are **no-ops when nothing changed** | Otherwise every 2s push bumps `updated_at` on all 30 notes and `?since=` returns everything, forever. |
| A tombstoned note is **never resurrected** by an upsert | A device that hasn't pulled yet still holds the note and will push it back. Making deletes stick is the entire point. |
| Absence of `notes` ≠ deletion | The client only ever sends its most recent 30 (`SNAP_MAX`); delete-by-absence would wipe note 31 onward. |
| `notes` is full state; `folders` is **intentions only** | The notes upsert refuses tombstoned rows, so re-sending every note is harmless. The folders upsert deliberately *un*-deletes (so re-creating a deleted path works), which means the client must send only folders the user just created — sending its whole list would revive folders another device had deleted. `app.js` tracks these in `bbn.pending`. |
| `sidebarImage` **omitted** = leave it; **`null`** = clear it | The client doesn't carry the 120KB image in a normal push, so "omitted means clear" would wipe the wallpaper on every autosave. |
| `prefs` is refused if its `t` is older than the stored one | Stops a laggy device replaying an old blob over a newer one. |
| One malformed note is skipped, not fatal | It must not strand the other twenty-nine. |

### Status codes

| | |
|---|---|
| Bad/missing `x-sync-key` (not `/^[0-9a-f]{64}$/`) | `400` `bad key` |
| Key resolves to a row whose verifier rejects it | `403` `key rejected` |
| `SYNC_PEPPER` or `DATABASE_URL` unset | `503` — fails **closed**, never storing everyone under an empty-key HMAC |
| Database unreachable / constraint violation | `502` `database unavailable` (the constraint name is logged) |
| Other methods | `405` with `Allow: GET, PUT` |
| Caching | `Cache-Control: no-store` |

### Where the logic lives

`notes-store.js` holds the untrusted-payload boundary as **pure functions** — folder
normalisation, block sanitising, prefs and image budgets — so it is tested without a
database ([`../tests/notes-store.test.js`](../tests/notes-store.test.js)). `db.js` is
the pool. The client-side half of the mapping is `snapshotToWireNote` /
`wireNoteToSnapshot` in `app.js`, tested in `tests/sync-wire.test.js`.

Schema: [`../migrations/`](../migrations/), applied with `npm run migrate`.

---

## `img.js` — pasted-image store

Still on KV; not migrated. Notes live in the URL and image bytes can't fit there, so
pasted/dropped images are **compressed client-side**, uploaded here, and referenced by
a short id. The markdown only ever stores the `/api/img?id=…` URL, never the bytes.

| | |
|---|---|
| **`POST`** | Body `{ type, data }`. `type` ∈ `{image/jpeg, png, webp, gif}`; `data` = base64 string ≤ `MAX_B64` (500 000, ~375 KB) → else `400`/`413`. Stores `img:<id>` and returns `{ id }` (random 10-char base36). |
| **`GET`** | `?id=` must match `/^[a-z0-9]{8,16}$/` → else `400`. Returns the raw bytes with the stored `Content-Type` and `Cache-Control: public, max-age=31536000, immutable`; `404` if unknown. |
| **Other methods** | `405` with `Allow: GET, POST`. |
| **No KV configured** | `503` `image store not configured`. |
| **KV error** | `502` `kv unavailable`. |

---

## Conventions

- **Fail soft.** Missing store → `503`, never a crash; the client is built to degrade.
- **Fail closed on auth.** A missing `SYNC_PEPPER` must 503, not silently HMAC
  everyone under an empty key into one shared account.
- **Validate every input** against a strict regex / allow-list before it reaches a
  store — and before it reaches a *constraint*, so a bad payload is a skipped row
  rather than a 500 that fails someone's whole sync.
- **`vercel.json`** rewrites everything *except* `/api/` to `index.html`;
  `server.js` reproduces that rewrite.
- Setup for both stores is in the root `README.md`.
