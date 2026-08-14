# byebyenotes

A minimal, terminal-aesthetic block-based notepad that lives entirely in the URL. Write notes and code side by side, pick a language, font, and theme, then share a single link — no accounts, no servers, no storage.

## How it works

Your blocks, font, and theme are compressed with [LZ-String](https://github.com/pieroxy/lz-string) and stored in the URL hash. Hit `Ctrl+Shift+C` to copy the share link — that's it.

## Features

- **Block-based editor** — mix text blocks and syntax-highlighted code blocks freely
- **Live markdown** — headings, lists, checkboxes, bold/italic, strikethrough (`~~x~~`), colored highlights (`==x==`, `==red:x==`), inline code; markers stay dimly visible
- **Format selection** — select text and press `/` for bold, italic, strikethrough, inline code, or a highlight color
- **Images by link** — `![alt](https://…/pic.png)` renders the image; add `|width` and `|left/center/right` to size and place it (e.g. `![pic|400|center](url)`). Pasting a bare image URL wraps it automatically. Only the link is stored — image files can't fit in a URL
- **Syntax highlighting** — Python, JavaScript, TypeScript, SQL, Bash, JSON, YAML, Go, Rust via highlight.js
- **Command palette** — `/` in an empty block inserts at the caret; `⌘K` opens global commands
- **Share panel** — `⌘⇧C` copies the link and shows a QR code (scan → note opens on your phone) plus a URL-capacity gauge
- **Sidebar file tree** — a persistent left panel listing every saved note, grouped by folder, with file-type badges (`M↓`, `JS`) and `.md`/`.js` extensions. `⌘B` / `Ctrl+B` toggles it
- **Tabs** — notes you open stack up as numbered tabs above the editor; `Ctrl+1`–`9` jumps between them, `×` closes. Only the active tab's note lives in the URL, so sharing is unchanged
- **Line numbers** — a vim-style gutter numbering continuously across every block
- **Sidebar backgrounds** — `/settings` opens a floating window with wallpaper swatches and drag bars for opacity, blur, brightness, saturation, text scrim and position. Filters sit on their own layer, so file names stay sharp at any blur
- **Recent notes** — your last 30 notes are kept in localStorage and listed on the start screen; the URL also auto-syncs as you type, so refreshing never loses work
- **Folders** — hover a recent note and hit ▦ to file it into a folder (pick one or type a new name); folders are collapsible and sync across devices
- **Cross-device sync (opt-in)** — `/sync` + a passphrase syncs your recent notes and theme/font across devices via Vercel KV. The passphrase never leaves the browser (only its SHA-256 hash keys the store). Logged out, the app stays 100% serverless
- **Remembered preferences** — your chosen theme and font apply to every fresh note (localStorage)
- **Focus mode** — `/focus` or `⌘.` dims everything but the block you're writing
- **Hover controls** — move, delete, and add blocks with the hover gutter; code blocks get a header with language badge, line count, and copy
- **Mobile editing** — floating `/` button, bottom-sheet palette, tap-to-select block toolbar
- **13 themes** — Monokai, GitHub Dark, Nord, Solarized Light, Dracula, One Dark, Tokyo Night, GitHub Light, Atom One Light, Gruvbox Light, Solarized Dark, Gruvbox Dark, Catppuccin Mocha
- **5 monospace fonts** — JetBrains Mono, Fira Code, Source Code Pro, IBM Plex Mono, Roboto Mono
- **Auto-closing brackets** — `(`, `[`, `{`, `'`, `"` auto-close in code blocks
- **Smart indent** — auto-indents after `:` (Python-style) and bracket expansion on Enter
- **Block reordering** — move blocks up/down with `Ctrl+Shift+↑/↓`
- **Export** — save as Markdown, PDF, Word (.docx), or HTML (with filename prompt)
- **New note** — `/newNote` clears the editor; optionally saves current note first
- **URL-based sharing** — everything lives in the hash, nothing stored server-side

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | In an empty block: insert palette at the caret. Elsewhere it just types `/` |
| `Ctrl+K` / `Cmd+K` | Open command palette from anywhere |
| `Ctrl+Shift+C` / `Cmd+Shift+C` | Copy link + open share panel (QR, capacity) |
| `Ctrl+.` / `Cmd+.` | Toggle focus mode |
| `Ctrl+B` / `Cmd+B` | Show/hide the sidebar file tree |
| `Ctrl+1` … `Ctrl+9` | Jump to that numbered tab (Ctrl only — `Cmd+1–9` is the browser's own tab switcher) |
| `Enter` (text block) | Line break inside the block — unless you're in a list, which continues |
| `Shift+Enter` (text block) | New block below |
| `Shift+Enter` (code block) | Exit the code block (Enter makes newlines while coding) |
| `Tab` | Insert 4 spaces |
| `Ctrl+Shift+↑` / `Cmd+Shift+↑` | Move block up |
| `Ctrl+Shift+↓` / `Cmd+Shift+↓` | Move block down |
| `↑ / ↓` | Navigate palette |
| `Enter` | Confirm palette selection |
| `Escape` | Close palette / share panel / focus mode |

## Commands

Type `/` to open the palette, then search or pick:

| Command | Action |
|---------|--------|
| `/box` | Insert a code block (choose language) |
| `/share` | Open the share panel — link, QR code, URL capacity |
| `/sync` | Cross-device sync via passphrase (again to turn off) |
| `/home` | Back to the start screen (current note saved to recents) |
| `/focus` | Toggle distraction-free focus mode |
| `/font` | Switch font — active font marked `current` |
| `/theme` | Switch theme — active theme marked `current` |
| `/settings` | Floating window: sidebar background swatches + drag bars, show/hide the panel |
| `/help` | Floating window listing every command, shortcut and formatting mark |
| `/delete` | Delete the current block |
| `/export` | Export as MD, PDF, DOCX, or HTML (prompts for filename) |
| `/newNote` | Start a fresh note (saves current note first if `/save_before_new` is on) |
| `/save_before_new` | Toggle auto-save before new note (`on` by default) |

## Running locally

No build step — just open `index.html` in a browser, or serve it:

```bash
npx serve .
```

## Enabling cross-device sync (one-time setup)

Sync needs a KV store attached to the Vercel project:

1. Vercel dashboard → your project → **Storage** → **Create Database** → **Upstash Redis** (free tier is plenty)
2. Connect it to the project — Vercel injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) automatically
3. Redeploy. Done — `/sync` now works.

Without a KV store, `/api/sync` returns 503 and the app quietly stays local-only.

## Deploying with Docker (Railway, Fly, a VPS)

Vercel is the primary target, but the app also runs as a container. `server.js` is a
zero-dependency Node adapter that supplies the two things Vercel provides for free:
static hosting with the SPA rewrite from `vercel.json`, and the enhanced `req`/`res`
that `api/*.js` expect (`req.query`, `req.body`, `res.status().json()`). The handlers
themselves are untouched, so the same files keep working on Vercel.

```bash
docker build -t byebyenotes .
docker run -p 3000:3000 byebyenotes          # → http://localhost:3000
```

Or without Docker: `node server.js` (Node 18+, since `api/*.js` use global `fetch`).

**On Railway:** point it at the repo — `railway.json` selects the Dockerfile and sets
`/healthz` as the health check. Railway injects `PORT`; the server reads it.

**Sync, images and tiny links need a KV store.** `api/*.js` speak the **Upstash REST
API**, not the Redis wire protocol — so Railway's own Redis plugin will *not* work.
Add an [Upstash Redis](https://upstash.com) database (free tier is plenty) and set:

| Variable | |
|----------|---|
| `KV_REST_API_URL` | Upstash REST URL (`UPSTASH_REDIS_REST_URL` also accepted) |
| `KV_REST_API_TOKEN` | Upstash REST token (`UPSTASH_REDIS_REST_TOKEN` also accepted) |

Without them the app still runs completely — notes live in the URL — and `/sync`,
image upload and tiny links return 503, exactly as on Vercel with no KV attached.
`GET /healthz` reports whether KV is configured.

The container serves an **allowlist** of static files (`index.html`, `app.js`,
`style.css`, `/assets/**`); everything else falls through to the SPA shell. That is
deliberate — the working directory also contains `server.js`, `package.json` and
`api/*.js`, which Vercel would never expose.

## Tech stack

- Vanilla JS — no framework, no build step
- [highlight.js](https://highlightjs.org/) — syntax highlighting
- [LZ-String](https://github.com/pieroxy/lz-string) — URL compression
- [html-docx-js](https://github.com/evidenceprime/html-docx-js) — DOCX export
- Google Fonts — JetBrains Mono, Fira Code, Source Code Pro, IBM Plex Mono, Roboto Mono
