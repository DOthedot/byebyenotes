# CLAUDE.md — byebyenotes

Orientation for Claude / AI agents. This file is intentionally short: the **deep
contributor guide is [`AGENTS.md`](./AGENTS.md)** — read it before editing anything.
When guidance here and in `AGENTS.md` overlap, `AGENTS.md` is the source of truth.

## 30-second model of the app

A terminal-aesthetic, block-based notepad where **the whole note lives in the URL**.
No accounts, no notes database. State is compressed with LZ-String into
`location.hash`. Signed out, the app is 100% functional with **zero backend**.

Turn on `/sync` and a **Postgres** database becomes the source of truth for your notes,
folders and prefs (`api/sync.js`); pasted images still use a Vercel KV store. Neither
is required to use the app.

- **No build step.** Plain HTML/CSS/JS + CDN `<script>` tags. Do **not** add a
  bundler, framework, transpiler, or npm runtime dependency.
- **`blocks[]` is the source of truth, not the DOM.** Each block is
  `{ id, type: 'text'|'code', lang, content }`. See `AGENTS.md → Core architecture`.
- **One note is open at a time, even with tabs.** `blocks[]` and `location.hash` still
  hold exactly one note — the active tab's. A tab is only a reference (`nid`) to a
  saved snapshot; switching tabs saves the current note, then loads the other's hash.
- **The sidebar and the tabline are views onto `bbn.recent`**, the same localStorage
  snapshot list the home screen renders. They add no new store.
- **Deploy = push to `main`.** The deployment that owns the database owns the app:
  `/api/sync` needs `DATABASE_URL` + `SYNC_PEPPER`, which is Railway (`server.js` +
  `Dockerfile`). Commit/push only when the user asks.
- **Schema changes are a separate step.** `npm run migrate` — never on container boot,
  which races itself the moment there is more than one replica.

## Where things live

| Path | What it is | Docs |
|------|-----------|------|
| `index.html` | Static DOM shell (empty-state, app shell + sidebar + tabline, status bar, palette, share panel, FAB) and the inline pre-paint script that restores the sidebar's open/closed state. | — |
| `app.js` | **All** app logic (~3100 lines, one file on purpose). | `AGENTS.md` |
| `style.css` | All styles + the 13 theme variable blocks. | — |
| `api/` | Server endpoints — `sync.js` (Postgres), `db.js`, `auth.js`, `notes-store.js`, `img.js` (KV). | [`api/README.md`](./api/README.md) |
| `migrations/` | Postgres schema, applied in filename order by `npm run migrate`. | — |
| `server.js` | Node front door for Railway/VPS. **Owns `/api/sync`** — Vercel has no route to the database. | — |
| `tests/` | Jest (jsdom) unit tests for the **pure** functions. | [`tests/INDEX.md`](./tests/INDEX.md) |
| `docs/` | Specs, plans, and mocks. | [`docs/README.md`](./docs/README.md) |
| `assets/` | Wallpaper images for the sidebar background picker. | — |
| `vercel.json` | SPA rewrite that excludes `/api/`. | — |

## Verification (one command)

```bash
npx jest      # unit tests — must pass before any change is "done"
```

For anything with **runtime behavior**, tests alone are not enough — drive the real
app in a browser (reproduce first, then confirm the fix). See
`AGENTS.md → Gotchas` for the cache-busting rule and the hidden-element trap.

Pure functions are the testable seam: export any new one at the bottom of `app.js`
under the `typeof module !== 'undefined'` guard, then add a case in `tests/`. The full
map of what's covered is in **[`tests/INDEX.md`](./tests/INDEX.md)**.

## The pre-commit review gate (enforced, not advisory)

A `PreToolUse` hook (`.claude/hooks/pre-commit-review-gate.sh`) **blocks `git commit`**
whenever `app.js`, `style.css`, `index.html`, or `api/**` differ from `HEAD` unless
`.claude/reviews/latest.md` holds a fresh **`code-reviewer`** approval matching the
exact current diff. Full workflow (dispatch the subagent, surface its questions with
`AskUserQuestion`, emergency `BBN_SKIP_REVIEW=1` bypass) is in
`AGENTS.md → Pre-commit review`. Don't touch `.claude/` without the user's sign-off.

## House rules

- Match the existing code style; keep logic in `app.js`; keep it a single file.
- Small, focused, Conventional-Commits-style commits; explain the *why* (root cause
  for bug fixes) in the body. Branch off `main`; never commit straight to it.
