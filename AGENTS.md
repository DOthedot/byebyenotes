# AGENTS.md — working in byebyenotes

Guidance for AI agents (and humans) contributing to this repo. Read this before editing.

## What this is

A terminal-aesthetic, block-based notepad where **the entire note lives in the URL**.
No accounts, no database for notes. State is compressed with LZ-String into
`location.hash`. Optional cross-device sync and pasted-image hosting use a Vercel KV
(Upstash Redis) store, but the app is fully functional with zero backend.

- **No build step.** Plain HTML/CSS/JS. Do not add a bundler, framework, or transpiler.
- **Deploy = push to `main`.** Vercel auto-deploys to `byebyenotes.vercel.app`
  (remote: `github.com/DOthedot/byebyenotes`). Commit and push only when asked.

## File map

| File | Role |
|------|------|
| `index.html` | Static DOM shell: empty-state, status bar, palette, share panel, FAB. CDN `<script>` tags. |
| `app.js` | **All** application logic (~2000 lines, intentionally one file). |
| `style.css` | All styles + the 7 theme variable blocks. |
| `api/sync.js` | Serverless fn: recent-notes + prefs sync, keyed by `SHA-256(passphrase)`. |
| `api/img.js` | Serverless fn: store/serve pasted images (client compresses first). |
| `tests/*.test.js` | Jest (jsdom) unit tests for the **pure** functions. |
| `vercel.json` | SPA rewrite that excludes `/api/`. |

CDN deps only (no npm runtime deps): highlight.js, lz-string, qrcodejs, html-docx-js.
Don't add dependencies without a strong reason.

## Core architecture (understand before changing)

- **`blocks[]` is the source of truth**, not the DOM. Each block is
  `{ id, type: 'text'|'code', lang, content }`. Keep `block.content` fresh — it is
  updated on `input` and `focusout`. Never let the model and DOM diverge silently.
- **Two-layer rendering.** Each block has a transparent `contenteditable`
  `.block-content` on top of a rendered layer behind it: `.hljs-layer` (code) or
  `.md-layer` (text markdown). While editing you see raw text; when blurred a text
  block with markdown swaps to the rendered `.md-layer`.
- **URL is storage.** `syncNow()` (debounced ~800ms) compresses `collectState()` into
  the hash via LZ-String. `renderMarkdown`, `capacityLevel`, snapshot merge, etc. are
  pure and unit-tested.
- **Palettes**: `/` = caret-anchored insert/format menu; `Cmd/Ctrl+K` = bottom-left
  command palette. Keep these two consistent and distinct.

## Gotchas that will bite you (hard-won)

1. **`innerText` of a hidden element drops newlines and can't be focused.** A text
   block with markdown has its `.block-content` set to `display:none` while not
   editing. Read text via `getBlockText(block)` (it checks `offsetParent` and falls
   back to `block.content`) — never read `innerText` from a possibly-hidden node.
2. **To mutate a rendered block, re-show it first.** Add the `editing` class and
   `.focus()` the `.block-content` before `execCommand`/selection work, or the
   operation silently no-ops on the hidden layer. (This was the cause of the
   "second highlight does nothing" bug.)
3. **Browsers cache `app.js`/`style.css` aggressively.** When verifying in a real
   browser, cache-bust: navigate to `?v=N` and `fetch(url, {cache:'reload'})` before
   asserting new behavior. A "fix that didn't work" is usually a stale cache.
4. **`/api/*` does not run on the static local server.** Sync/image features must be
   tested against the deployed site (or `vercel dev`). They degrade gracefully to 503.
5. **`/` is context-sensitive** (selection → format, word-boundary → insert, mid-word
   / code block → literal slash). Preserve this in the block keydown handler.

## Local dev & verification

```bash
python3 -m http.server 4173        # serve statically (no build)
npx jest                           # run unit tests (must pass)
```

Definition of done for a change:
1. `npx jest` passes. Add tests for any new **pure** function (export it at the bottom
   of `app.js` under the `typeof module !== 'undefined'` guard).
2. **Drive the real app in a browser** for anything with runtime behavior — don't rely
   on tests alone. Reproduce the bug first, then confirm the fix.
3. For `/api` / KV changes, round-trip against production with `curl` after deploy.
4. Match existing code style. Keep logic in `app.js`; keep it a single file.

## Pre-commit review (enforced by a hook)

A `PreToolUse` hook (`.claude/hooks/pre-commit-review-gate.sh`, wired in
`.claude/settings.json`) **blocks `git commit`** whenever `app.js`, `style.css`,
`index.html`, or `api/**` differ from `HEAD`, unless `.claude/reviews/latest.md`
contains a fresh **`code-reviewer`** approval for the exact current diff (matched by
content hash — see the marker line the agent writes). This is not just a convention:
the commit will actually fail with a deny reason until the gate is satisfied.

Workflow:
1. Finish the change and run `npx jest`.
2. Dispatch the **`code-reviewer`** subagent (`.claude/agents/code-reviewer.md`) on the
   working diff.
3. It writes the report (with the required marker line) and returns a verdict plus any
   "Questions for the user."
4. If it returns questions, **ask the user** with `AskUserQuestion` (single or
   multi-select) before proceeding — do not guess on decisions it flagged as theirs.
5. Fix any 🔴 Blockers / 🟡 Important findings and re-run the review — the hook checks
   the diff's hash, so any further edit invalidates a prior approval.
6. Commit and push. If the diff doesn't touch the gated files (e.g. docs/tests only),
   the hook is a no-op.

Emergency bypass: include `BBN_SKIP_REVIEW=1` anywhere in the commit command (e.g.
`BBN_SKIP_REVIEW=1 git commit -m "hotfix"`). Use sparingly and explain why to the user.

`.claude/reviews/` is gitignored (ephemeral, per-machine). The agent config and hook
script are tracked so the whole team/every session shares the same gate.

## Commit conventions

- Small, focused commits with a clear subject line and a body explaining the *why*
  (especially the root cause for bug fixes).
- Branch off `main` if not already on it; push only when the user asks.
