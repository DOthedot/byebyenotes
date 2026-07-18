# byebyenotes

A minimal, terminal-aesthetic block-based notepad that lives entirely in the URL. Write notes and code side by side, pick a language, font, and theme, then share a single link — no accounts, no servers, no storage.

## How it works

Your blocks, font, and theme are compressed with [LZ-String](https://github.com/pieroxy/lz-string) and stored in the URL hash. Hit `Ctrl+Shift+C` to copy the share link — that's it.

## Features

- **Block-based editor** — mix text blocks and syntax-highlighted code blocks freely
- **Live markdown** — headings, lists, checkboxes, bold/italic, inline code render as you write; markers stay dimly visible
- **Syntax highlighting** — Python, JavaScript, TypeScript, SQL, Bash, JSON, YAML, Go, Rust via highlight.js
- **Command palette** — `/` in an empty block inserts at the caret; `⌘K` opens global commands
- **Share panel** — `⌘⇧C` copies the link and shows a QR code (scan → note opens on your phone) plus a URL-capacity gauge
- **Recent notes** — your last notes are kept in localStorage and listed on the start screen; the URL also auto-syncs as you type, so refreshing never loses work
- **Focus mode** — `/focus` or `⌘.` dims everything but the block you're writing
- **Hover controls** — move, delete, and add blocks with the hover gutter; code blocks get a header with language badge, line count, and copy
- **Mobile editing** — floating `/` button, bottom-sheet palette, tap-to-select block toolbar
- **7 themes** — Monokai, GitHub Dark, Nord, Solarized Light, Dracula, One Dark, Tokyo Night
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
| `Shift+Enter` | Exit code block (focus next block) |
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
| `/focus` | Toggle distraction-free focus mode |
| `/font` | Switch font — active font marked `current` |
| `/theme` | Switch theme — active theme marked `current` |
| `/delete` | Delete the current block |
| `/export` | Export as MD, PDF, DOCX, or HTML (prompts for filename) |
| `/newNote` | Start a fresh note (saves current note first if `/save_before_new` is on) |
| `/save_before_new` | Toggle auto-save before new note (`on` by default) |

## Running locally

No build step — just open `index.html` in a browser, or serve it:

```bash
npx serve .
```

## Tech stack

- Vanilla JS — no framework, no build step
- [highlight.js](https://highlightjs.org/) — syntax highlighting
- [LZ-String](https://github.com/pieroxy/lz-string) — URL compression
- [html-docx-js](https://github.com/evidenceprime/html-docx-js) — DOCX export
- Google Fonts — JetBrains Mono, Fira Code, Source Code Pro, IBM Plex Mono, Roboto Mono
