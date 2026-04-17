# byebyenotes

A minimal, terminal-aesthetic block-based notepad that lives entirely in the URL. Write notes and code side by side, pick a language, font, and theme, then share a single link — no accounts, no servers, no storage.

## How it works

Your blocks, font, and theme are compressed with [LZ-String](https://github.com/pieroxy/lz-string) and stored in the URL hash. Hit `Ctrl+Shift+C` to copy the share link — that's it.

## Features

- **Block-based editor** — mix text blocks and syntax-highlighted code blocks freely
- **Syntax highlighting** — Python, JavaScript, TypeScript, SQL, Bash, JSON, YAML, Go, Rust via highlight.js
- **Command palette** — type `/` to open from anywhere, search and pick any command
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
| `/` | Open command palette (works even with no block focused) |
| `Ctrl+Shift+C` / `Cmd+Shift+C` | Copy shareable link |
| `Shift+Enter` | Exit code block (focus next block) |
| `Tab` | Insert 4 spaces |
| `Ctrl+Shift+↑` / `Cmd+Shift+↑` | Move block up |
| `Ctrl+Shift+↓` / `Cmd+Shift+↓` | Move block down |
| `↑ / ↓` | Navigate palette |
| `Enter` | Confirm palette selection |
| `Escape` | Close palette (or go back one level) |

## Commands

Type `/` to open the palette, then search or pick:

| Command | Action |
|---------|--------|
| `/box` | Insert a code block (choose language) |
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
