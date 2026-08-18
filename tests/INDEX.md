# Test Index & Glossary — byebyenotes

The complete map of the unit-test suite: **what is tested, where, and exactly what
each case asserts (and why)**. If you add or change a test, update this file too.

- **Suite:** 23 files, **202 tests** — all green.
- **Runner:** [Jest](https://jestjs.io/) 29, `testEnvironment: jsdom` (configured in
  `package.json`).
- **Run everything:** `npx jest` (or `npm test`). Run one file: `npx jest markdown`.
- **What is under test:** only the **pure functions** exported from `app.js` at the
  bottom, under the `if (typeof module !== 'undefined')` guard. DOM-heavy, event, and
  network behavior is verified by driving the real app in a browser (see
  `AGENTS.md → Local dev & verification`), **not** here.

## Test harness conventions (read once)

Every test file re-establishes the same two browser globals that jsdom lacks, because
`app.js` references them at module scope:

| Global | Stub | Why |
|--------|------|-----|
| `LZString` | `compressToEncodedURIComponent = btoa`, `decompress… = atob` (null on throw) | Real LZ-String isn't loaded in jsdom; base64 is a good-enough reversible stand-in so `encodeState`/`decodeState` can round-trip. |
| `hljs` | `highlight: (text) => ({ value: text })` | highlight.js is a CDN dep; the stub returns text unchanged so `buildBlockEl` for code blocks doesn't crash. Only `blocks.test.js` needs it. |

**Exception:** `notes-store.test.js` tests `api/`, not `app.js`. It declares
`@jest-environment node` in a docblock and needs neither stub — server code has no
browser globals to fake, and running it under jsdom would only hide that fact.

> **Adding a pure function?** Export it in the `module.exports` block at the bottom of
> `app.js`, then add a case to the most relevant file below (or a new `*.test.js`).
> If your function reads a browser/CDN global, stub it at the top of the file the same
> way. Pure = same output for same input, no DOM/network/`localStorage` side effects.

---

## Coverage at a glance

| Exported function | Tested in | What it does |
|-------------------|-----------|--------------|
| `encodeState` | `state.test.js` | Serialize `{blocks, font, theme}` → compressed hash string. |
| `decodeState` | `state.test.js` | Hash string → state object; `null` on empty/corrupt input. |
| `createBlock` | `blocks.test.js` | Build a block model `{id, type, lang, content}`. |
| `buildBlockEl` | `blocks.test.js` | Build the block's DOM element (two-layer render). |
| `insertDividerBlocks` | `blocks.test.js` | Plan a divider insert over `blocks[]` — empty block becomes the divider, a block with text is preserved and the divider goes after it (regression guard for #21). |
| `renderMarkdown` | `markdown.test.js` | Text block source → rendered markdown HTML (`.md-layer`). |
| `escapeHtml` | `markdown.test.js` | Escape `<`, `>`, `&`, `"` for safe HTML injection. |
| `toggleCheckboxLine` | `markdown.test.js` | Flip `- [ ]` ⇄ `- [x]` on a given source line. |
| `noteTitle` | `markdown.test.js` | Derive a display title from a note's blocks. |
| `capacityLevel` | `markdown.test.js` | URL length → `{ratio, level: green/amber/red}`. |
| `timeAgo` | `markdown.test.js` | Timestamp → relative label (`just now`, `5m ago`…). |
| `stripFormatting` | `markdown.test.js` | Remove one format category's markers from a region. |
| `mergeRecents` | `sync.test.js` | Merge local + remote recent-note snapshots. |
| `groupByFolder` | `sync.test.js` | Split snapshots into loose notes + sorted folders. |
| `nextNavIndex` | `home-nav.test.js` | Next Home-screen selection index for Arrow keys (wrap; `-1` = none). |
| `buildCommandList` | `help.test.js` | The ⌘K command list — asserted against as the source of the help COMMANDS section. |
| `buildHelpList` | `help.test.js` | Read-only `/help` reference: intro + COMMANDS (from `buildCommandList`) + SHORTCUTS + FORMATTING. |
| `makeRecentRow` | `recents.test.js` | Build a start-screen recent-note row DOM element; asserts the move-to-folder button's icon + accessible label. |
| `isOpenableSnapshot` | `recents.test.js` | Whether a recent snapshot can actually reopen (non-empty hash that decodes to blocks); guards save + click so a dead note never opens blank (issue #19). |
| `buildTreeRows` | `sidebar-tree.test.js` | Flattens `bbn.recent` snapshots into the sidebar's ordered rows (folders first, each followed by its notes unless folded, then loose notes). Wraps `groupByFolder`; tolerates a missing folded Set and non-array input. |
| `normalizeSidebarCfg` | `sidebar-bg.test.js` | Clamps every sidebar background value and rejects unknown wallpaper ids / positions. The trust boundary for `bbn.prefs.sidebar`, which arrives from localStorage **and** from other devices via `/api/sync`. |
| `sidebarCssVars` | `sidebar-bg.test.js` | A normalized config → the `--sb-*` custom properties the panel's `::before`/`::after` layers read. Pure string building, no DOM. |
| `filterPaletteItems` | `palette-filter.test.js` | The palette's search predicate (label/desc/hint, case-insensitive, leading `/` ignored). Split out of `filterPalette` so `openPalette(mode, { keep: true })` can re-apply a live filter without resetting the selected row — the seam behind repeatable `/settings` ± commands. |
| `SIDEBAR_LOOK_DEFAULTS` | `sidebar-bg.test.js` | The appearance-only subset of `SIDEBAR_DEFAULTS` (no `open`) that "reset background" restores, so a deliberately hidden sidebar stays hidden. |
| `restorableCaret` | `palette-caret.test.js` | Whether a saved caret `Range` may be re-applied when `closePalette` refocuses the block — start node still inside the block, else fall back to plain focus. Guards the caret restore that keeps ESC on a `/`-palette from jumping to the block start (issue #24). |
| `caretScrollDelta` | `scroll-caret.test.js` | Pixels to scroll `#document-container` so the caret stays visible with a margin (positive = down, negative = up, 0 = fine). The seam behind `scrollCaretIntoView`, which keeps Enter from dropping the caret below the fold (issue #26). |
| `parseTinyId` | `tiny.test.js` | `/s/<id>` path → validated tiny id, or `null`. |
| `tinyExpiryLabel`, `TINY_EXPIRY` | `tiny.test.js` | Expiry-option list (24hr first) + ttl→label with 24hr fallback. |
| `api/tiny.js` handler | `api-tiny.test.js` | The serverless handler itself (not an `app.js` export) — see its section below. |

Not yet unit-tested (browser/integration territory): palette/keyboard handling,
`syncNow`/URL persistence, image paste + `/api/img`, sync round-trip + `/api/sync`,
theme/font application, focus mode, export. (The DOM wiring of Home-screen keyboard
nav — row collection, `.kb-active`, Enter dispatch — is browser-verified; only its
pure index math `nextNavIndex` is unit-tested here.)

---

## `state.test.js` — URL state round-tripping (4 tests)

Covers the "the note lives in the URL" contract: `encodeState` / `decodeState`.

| Test | Asserts | Why it matters |
|------|---------|----------------|
| `encodeState produces a non-empty string` | Output is a non-empty `string`. | Encoding must always yield something hashable. |
| `decodeState round-trips state` | A 2-block state (text + `code`/`python`) survives encode→decode: block count, `lang`, `font`, `theme` all preserved. | Sharing a link must reproduce the note faithfully. |
| `decodeState returns null for empty hash` | `decodeState('') === null`. | A bare URL must fall through to the empty-state screen, not crash. |
| `decodeState returns null for corrupt hash` | `decodeState('!!!not-valid!!!') === null`. | Hand-edited / truncated links degrade gracefully instead of throwing. |

---

## `blocks.test.js` — block model & DOM construction (5 tests)

Covers `createBlock` (model) and `buildBlockEl` (the two-layer DOM per block).

| Test | Asserts |
|------|---------|
| `createBlock returns text block with unique id` | `type==='text'`, `content===''`, and two blocks get **different** ids. |
| `createBlock code block has lang` | `createBlock('code','python')` → `type==='code'`, `lang==='python'`. |
| `buildBlockEl returns div with block-content` | A `<div class="text-block">` containing a `.block-content` (the editable layer). |
| `buildBlockEl code block has hljs-layer and language badge` | `.code-block` element has a `.hljs-layer` and a `.lang-badge` whose text includes `python`. |
| `buildBlockEl text block has markdown layer` | Text block element has a `.md-layer` (the rendered-markdown layer behind the editable one). |

> **Two-layer render (context):** every block is a transparent `contenteditable`
> `.block-content` on top of a rendered layer — `.hljs-layer` for code, `.md-layer`
> for text. These tests pin the structure both layers depend on.

---

## `markdown.test.js` — rendering & pure helpers (19 tests)

The largest file. Groups by function; all assert on the HTML string / value returned.

### `stripFormatting` — "re-formatting a region makes it uniform"
Strips one category's markers so re-applying a format doesn't nest or leave danglers.

| Test | Asserts |
|------|---------|
| strips existing highlights so re-highlighting is uniform | `'==green:quick== brown ==red:fox=='` → `'quick brown fox'` (all `==…==` gone). |
| repairs a broken nested-highlight run | A malformed nested `==…==` run leaves **no** dangling `==` and keeps the plain text (`These are physiological`). |
| bold strips only bold markers, leaves highlights | `'a **b** ==red:c=='` + category `bold` → `'a b ==red:c=='` (highlights untouched). |
| italic strips lone asterisks but not bold | `'*a* and **b**'` + `italic` → `'a and **b**'` (`**bold**` preserved). |
| plain text is untouched | No markers → returned verbatim. |

### `renderMarkdown` — source line(s) → rendered HTML
Returns `''` when there's nothing to render (so the plain editable layer is shown).

| Test | Asserts |
|------|---------|
| plain text renders nothing | `'just a plain line'`, `''`, and `'   '` all render `''` (no `.md-layer` needed). |
| headings render with dim marker and level class | `# / ## / ###` → `md-h1/2/3` classes + a `<span class="md-mark">#</span>` (marker stays dimly visible). |
| bullets, checkboxes, dividers render | `- item`→`md-li`; `- [ ]`→`md-check`; `- [x]`→`md-check done`; `---`→`md-divider`. |
| inline bold, italic, code render | `**b**`→`<strong>`, `*b*`→`<em>`, `` `code` ``→`<code class="md-code">`. |
| strikethrough and colored highlights render | `~~x~~`→`<del>`; `==x==`→`<mark class="hl-yellow">`; `==red:x==`→`hl-red`; `==blue:x==`→`hl-blue`. |
| **html in content is escaped** | `# <script>…` never yields a literal `<script>`; becomes `&lt;script&gt;`. **(XSS guard.)** |
| checkbox lines carry their source line index | Each rendered checkbox has `data-line="N"` matching its line in the source (so clicks map back to the right line). |
| markdown images render with width and alignment | `![pic](url)`→`<img src="url"` + `md-img left`; `![pic|400|center](url)`→`width:400px` + `md-img center`; **`![x](javascript:…)` never renders an `<img>`** (only `http(s)` sources — XSS guard). |
| free-positioned images render offset and rotation | `![pic|300|pos:22.5,-40,-7](url)` → `md-img free`, `left:22.5%`, `top:-40px`, `rotate(-7deg)`. |

### `toggleCheckboxLine`
| Test | Asserts |
|------|---------|
| flips unchecked to checked and back | Line 0 of `'- [ ] task\n- [x] other'` → `- [x] task`; line 1 → unchecks; an **out-of-range** index (5) returns the source unchanged. |

### `noteTitle`
| Test | Asserts |
|------|---------|
| strips markdown markers and truncates | `# My Note\nbody`→`'My Note'`; `- [ ] task one`→`'task one'`; skips empty blocks to the first with content; all-empty → `'untitled'`. |

### `capacityLevel` — URL fill gauge
Ratio = `urlLen / URL_SAFE_LIMIT` (`URL_SAFE_LIMIT = 8000`), capped at 1.
Level: `green` if ratio `< 0.6`, `amber` if `< 0.85`, else `red`.

| Test | Asserts | Maps to |
|------|---------|---------|
| capacityLevel thresholds | `100`→`green`; `5600`→`amber`; `7500`→`red`; `20000`→`ratio===1`. | `<4800` green · `4800–6799` amber · `≥6800` red · length caps the bar at 100%. |

### `timeAgo`
Boundaries: `<60s` → `just now`; `<60m` → `Nm ago`; `<24h` → `Nh ago`; else `Nd ago`.

| Test | Asserts |
|------|---------|
| formats relative time | `-30s`→`just now`; `-5m`→`5m ago`; `-3h`→`3h ago`; `-2d`→`2d ago` (uses the injected `now`, so it's deterministic). |

### `escapeHtml`
| Test | Asserts |
|------|---------|
| escapes angle brackets, amps, quotes | `'<a href="x">&</a>'` → `'&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;'`. |

---

## `sync.test.js` — recent-note merge & folders (5 tests)

Pure logic behind cross-device sync and the start-screen folder view. Uses a `snap()`
helper building snapshots `{ nid, t, title, folder, blockCount, langs }` (`t` = time).

| Test | Asserts | Why |
|------|---------|-----|
| `mergeRecents keeps newest entry per note id` | For the same `nid`, the higher-`t` entry wins (title becomes `a-newer`); result ordered newest-first → `['a','c','b']`. | Two devices editing the same note must converge on the latest, not duplicate it. |
| `mergeRecents sorts newest-first and caps at 30` | 35 inputs → 30 kept, `merged[0].nid==='n34'` (highest `t`). | The recents list is bounded; only the freshest 30 survive. |
| `groupByFolder splits loose notes from sorted folders` | Foldered notes group under **alphabetically sorted** folder names (`['ideas','work']`); within a folder, notes keep newest-first order; un-foldered notes go to `loose`. | Drives the collapsible-folder start screen. |
| `groupByFolder treats blank folder as loose` | A folder of `'  '` (whitespace) counts as no folder → both notes land in `loose`, `folders` empty. | Prevents phantom blank folders. |
| `mergeRecents tolerates null/invalid input` | `mergeRecents(null, undefined) → []`; `[null, {}, snap('a',1)]` filters junk → `['a']`. | Corrupt localStorage / API payloads must never crash the start screen. |

---

## `home-nav.test.js` — Home-screen list navigation (5 tests)

Covers `nextNavIndex(current, key, count)`, the pure index math behind arrow-key
navigation of the start-screen recent-notes list. `current === -1` means nothing is
selected; from there `ArrowDown` picks the first row and `ArrowUp` the last, and
otherwise the selection wraps around the ends.

| Test | Asserts | Why it matters |
|------|---------|----------------|
| empty list yields no selection | `count === 0` → `-1` for any key/current. | An empty recents list has nothing to highlight; never point at a phantom row. |
| from no selection, Down picks first and Up picks last | `(-1,'ArrowDown',3)→0`; `(-1,'ArrowUp',3)→2`. | First keypress enters the list from the natural end. |
| Down wraps past the end | `(0,'ArrowDown',3)→1`; `(2,'ArrowDown',3)→0`. | Moving down off the last row cycles back to the top. |
| Up wraps past the top | `(1,'ArrowUp',3)→0`; `(0,'ArrowUp',3)→2`. | Moving up off the first row cycles to the bottom. |
| unrelated keys leave the index unchanged | `(1,'Enter',3)→1`; `(1,'a',3)→1`. | Only Arrow keys move the selection; everything else is handled elsewhere. |

---

## Not unit-tested (browser-verified only)

These ship without unit tests because they are DOM/interaction wiring with no pure
seam worth extracting. They are verified by driving the real app in a browser:

| Feature | Why no unit test | What to re-check by hand |
|---------|------------------|--------------------------|
| Tabline (`renderTabline`, `switchToTab`, `closeTab`) | Reads `location.hash` and mutates global note state; the interesting behaviour *is* the navigation. | Open several notes, switch, close the active and the last tab, reload — tabs restore and no note loses content. |
| Line-number gutter (`renderLineNumbers`) | Pure DOM measurement against rendered blocks. | Numbers stay continuous across blocks and aligned as you type. |
| `/settings` + `/help` floats | CSS class toggling on the existing palette. | Both centre, the title sits on the frame, Esc backs out to the command menu. |
| Sidebar drag bars | `input` events on `<input type=range>`. | Dragging previews live; the value survives a reload. |

`logos.test.js`, `palette-esc.test.js` and `themes.test.js` are also absent from the
tables above — a pre-existing gap, not related to the sidebar work.

---

## `help.test.js` — the `/help` reference panel (7 tests)

Covers `buildHelpList()`, the pure builder behind the read-only `/help` panel. The panel
itself (a new `help` palette mode, non-interactive rows, Escape/Enter to dismiss) is DOM
wiring and is **browser-verified**, not here — only the list content is unit-tested.

| Test | Asserts | Why it matters |
|------|---------|----------------|
| opens with an intro row that mentions the URL | `list[0]` has no `heading` and its label/desc mentions "url". | The panel leads with the app's one-line pitch, not a command. |
| has COMMANDS, SHORTCUTS and FORMATTING sections in order | The `heading` rows are exactly `['COMMANDS','SHORTCUTS','FORMATTING']`. | Pins the panel's structure and ordering. |
| COMMANDS lists every command except help itself | Every `buildCommandList()` entry (id ≠ `help`) appears by label; `/help` does **not**. | The section is generated from `buildCommandList()`, so it can't drift — and help doesn't document itself. |
| SHORTCUTS documents the core key bindings | Rows carry `kbd` values `⌘K`, `⌘⇧C`, `⌘.`, `⌘B`, `/`, `Enter`, `⇧Enter`. | These match the real key handlers in `app.js`. |
| SHORTCUTS documents the sidebar toggle | A row with `kbd === '⌘B'` exists and its label mentions "sidebar". | `⌘B` shipped undocumented; `/help` is the only place it's discoverable besides `/settings`. |
| FORMATTING documents markdown syntax | `bold`/`italic`/`highlight` descs contain `**`/`*`/`==`; rows include heading, checklist, divider. | The syntax cheatsheet stays accurate. |
| every row is either a heading or has a label | For each item, `heading` or `label` is truthy. | Guards the render contract (`renderPaletteList` branches on `heading`). |

---

## `recents.test.js` — start-screen recent-note row + snapshot openability (10 tests)

Covers `makeRecentRow(snapshot)`, which builds one recent-note row for the Home screen,
and `isOpenableSnapshot(snapshot)`, the openability guard behind issue #19. Only the
**move-to-folder button's presentation** is asserted for the row (icon + accessible
name); the row's click behavior (open note / delete / move) is DOM/event wiring and is
browser-verified, not here. `makeRecentRow` builds cleanly under jsdom because it touches
only `document`, `escapeHtml`, and `timeAgo` at build time — the app-state calls happen
inside the click listener, which the test never fires.

| Test | Asserts | Why it matters |
|------|---------|----------------|
| renders a move-to-folder button | The row contains a `.ri-folder` element. | The affordance exists on every row. |
| uses a vector icon, not the old ▦ glyph | `.ri-folder` contains an `<svg>` and its text has no `▦`. | Pins the fix — the button reads as a folder, not a grid square (issue #6). |
| has an accessible label instead of a native title | `aria-label === 'move to folder'` and **no** `title` attribute. | Removing `title` (for the custom tooltip) must not drop the screen-reader name. |
| exposes its label to the styled tooltip via data-tip | `data-tip === 'move to folder'`. | The dark palette tooltip is driven by `[data-tip]::after`. |
| `isOpenableSnapshot` true for a decodable hash with blocks | A hash decoding to `{blocks:[…]}` → `true`. | Real notes still open. |
| false for an empty-string hash | `hash: ''` → `false`. | The reported "no # at all" blank-note case (issue #19). |
| false for a missing hash field | no `hash` → `false`. | The `#undefined` variant. |
| false for an undecodable hash | garbage hash → `false`. | Corrupt/legacy entries can't strand the user. |
| false when decoded state has no blocks | `{blocks:[]}` → `false`. | An empty note isn't openable content. |
| false for a null/undefined snapshot | `null`/`undefined` → `false`. | Defensive: no throw on bad input. |

---

## `tiny.test.js` — tiny-URL client helpers (4 tests)

Pure helpers behind tiny-URL sharing. The DOM/async flow (share-panel upload, `/s/<id>`
resolution) is browser-verified, not here.

| Test | Asserts | Why it matters |
|------|---------|----------------|
| `parseTinyId` extracts the id from `/s/<id>` | `/s/abc123` and `/s/abc123/` → `'abc123'`. | Boot uses this to detect a tiny link before the normal hash load. |
| `parseTinyId` returns null for non-tiny/invalid paths | `/`, `/index.html`, too-short/bad-char ids, and `/s/<id>/extra` → `null`. | Normal notes must fall through to hash loading; only a clean `/s/<id>` resolves. |
| `TINY_EXPIRY` lists 24hr first, four options | `[0].ttl === 86400`; ttls are exactly `{60,1800,21600,86400}`. | Default is 24hr; the select + api share this option set. |
| `tinyExpiryLabel` maps ttl → label, falls back to 24hr | `1800→'30min'`, `86400→'24hr'`, unknown→`'24hr'`. | Footer text ("expires in …") stays correct. |

## `api-tiny.test.js` — the `api/tiny.js` serverless handler (8 tests)

The only test that drives a **serverless handler** directly (the others test `app.js`
exports). It `require`s `api/tiny.js` with a mocked `(req, res)` and a mocked KV REST
endpoint (`global.fetch`); env is set per-case so the handler's load-time KV detection is
exercised. Mirrors the fail-soft contract in [`../api/README.md`](../api/README.md).

| Test | Asserts |
|------|---------|
| 503 when KV not configured | No KV env → `503`. |
| POST rejects a ttl not in the allowed set | `ttl` outside `{60,1800,21600,86400}` → `400`. |
| POST stores the hash with a Redis TTL and returns an id | `200 {id}` (id matches `/^[a-z0-9]{6,12}$/`) and the kv command is `['SET','tiny:<id>',hash,'EX',ttl]`. |
| POST rejects an oversized hash | hash > 200000 chars → `413`. |
| GET unknown id returns 404 | kv returns null → `404`. |
| GET known id returns the stored hash | kv returns the value → `200 {hash}`. |
| GET bad id returns 400 | id failing `/^[a-z0-9]{6,12}$/` → `400`. |
| unsupported method returns 405 | `DELETE` → `405`. |

> **Note:** this suite adds handler coverage, but the true end-to-end path (real KV,
> `/s/<id>` rewrite) is only exercised on the deployed site — see `AGENTS.md → Gotchas`.

## `asset-paths.test.js` — index.html asset references (2 tests)

Not a function test — it reads `index.html` as text. Guards **issue #17**: a tiny link
`/s/<id>` is a nested path, so a *relative* local asset ref (`href="style.css"`) resolves
to `/s/style.css`, the SPA rewrite serves `index.html` back as `text/html`, and the
browser rejects the CSS/JS by MIME type → blank page. Local asset refs must be
root-absolute so they load identically from `/` and `/s/<id>`.

| Test | Asserts |
|------|---------|
| every local asset reference is root-absolute | No `href`/`src` in `index.html` that is a local file (not `http(s):`/`//`/`data:`/`#`) may be relative. |
| style.css and app.js use a leading slash | `index.html` references `/style.css` and `/app.js`. |

---

## `notes-store.test.js` — the untrusted-payload boundary (32 tests)

Tests `api/notes-store.js`, the pure half of `/api/sync`. Every value here arrives from
a browser holding a sync key and is then handed to **another of that user's devices to
render**, so these cases are about what a hostile or broken payload is allowed to
become. The bar is: never a constraint violation (which 500s someone's entire sync),
never markup, never a resurrected note.

| Group | Asserts |
|------|---------|
| `normalizeFolder` | Trims and joins like `app.js folderSegments`; collapses `//`; top level is `null` and never `''` (which `notes_folder_shape` rejects); caps depth at 12 — the same cap that stopped `renderSidebar` blowing the stack; rejects over-long paths and non-strings, so `{}` can't become a folder named `[object Object]`. |
| `sanitizeBlocks` | Unknown block types degrade to `text`; `lang` is slug-only because it becomes a highlight.js **class name**; non-string content becomes `''`, not `"[object Object]"`; a non-array is `null` (matching `notes_blocks_is_array`); oversize is `null` (matching `notes_blocks_size`). |
| `sanitizeNote` | Unusable `nid` → dropped; missing title → `'untitled'` rather than a NOT NULL violation; title truncated to the same 48 chars `/rename` allows; `titlePinned` is strictly boolean, so a truthy string can't pin a title. |
| `sanitizeNotes` | One broken note doesn't strand the other twenty-nine; a duplicate `nid` collapses to the last — Postgres refuses to let one upsert touch a row twice, which would fail the whole push; batch is capped. |
| `sanitizePrefs` | Strips the wallpaper (it has its own column and its own budget); rejects rather than truncates over 32KB — half-written prefs are worse than stale ones; only a plain object qualifies. |
| `sanitizeImage` | Inline `data:` images only — a remote URL would make every sidebar render fetch a third party; rejects `data:text/html`, `javascript:`, and anything over the column cap. |
| `rowToNote` | `updated_at_ms` arrives from `pg` as a **string** (bigint) and must become a number, or `mergeRecents` sorts wrong; tombstones are flagged. |

---

## `sync-wire.test.js` — client ⇄ server note mapping (13 tests)

`snapshotToWireNote` / `wireNoteToSnapshot` in `app.js`. The server stores `blocks` and
has no LZString, so the URL hash is re-derived on the client. That makes these two
functions the single point where a note can be silently mangled on its way to another
device — hence the round trip is asserted on **identity**, not field by field.

| Test | Asserts |
|------|---------|
| unpacks the hash into blocks | The hash is decoded, not forwarded. |
| carries the columned fields | `titlePinned`, `folder`, `theme`, `font` survive. |
| does not send the hash | Storing it too would be a second copy that can disagree. |
| an undecodable hash is dropped | Pushing it as `blocks: []` would overwrite a good server-side note with nothing — issue #19's failure mode, one layer down. |
| top level is `null`, not `''` | Maps onto a nullable column. |
| rebuilt hash decodes to the same state | The re-derivation is lossless. |
| `titlePinned` ⇄ `renamed` | The two names for one flag stay in step. |
| re-derives `blockCount` / `langs` | Not trusted from the server. |
| a malformed row is dropped | Never becomes a blank snapshot. |
| missing `t` falls back to now | `mergeRecents` must never sort on `NaN`. |
| round trip is lossless | `snapshot → wire → snapshot` is `toEqual` the original. |
| an empty note survives | Doesn't collapse to `null`. |
| the merge key survives | `mergeRecents` still dedupes across the trip. |

> **Note:** the database half — auth, upserts, tombstones, the no-op guard — is not in
> this suite. It needs a real Postgres, and is verified by driving the deployed
> endpoint. See `api/README.md`.

---

## Conventions for new tests

1. **Test the pure core, not the DOM.** If behavior needs a real browser (events,
   selection, focus, network), verify it by driving the app — note it in the
   "Not yet unit-tested" list above rather than faking a brittle jsdom test.
2. **Export first.** Add the function to `module.exports` at the bottom of `app.js`.
3. **Stub globals at the top of the file** (`LZString`, `hljs`) exactly as the
   existing files do — `app.js` touches them at import time.
4. **Assert the contract, not the implementation** — prefer "renders `<strong>`" over
   matching an exact whitespace-sensitive HTML blob.
5. **Update this file** with the new function row and per-case rows.
6. `npx jest` must be green before the change is done (`AGENTS.md → Definition of done`).
