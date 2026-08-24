// The shape layer between the browser's JSON and the notes/folders/user_prefs rows.
//
// Split out of api/sync.js so the interesting half — deciding what an untrusted
// payload is allowed to become — is pure, and therefore testable without a
// database (tests/notes-store.test.js).
//
// Everything here treats input as hostile. It arrives from a browser holding a
// sync key, and whatever survives is handed to ANOTHER of that user's devices to
// render. Normalising to a known shape is cheaper than a CHECK-constraint 500,
// and it keeps a malformed row from ever reaching a second client.

const MAX_NOTES_PER_REQUEST   = 200;
const MAX_FOLDERS_PER_REQUEST = 200;
const MAX_BLOCKS_PER_NOTE     = 500;
const MAX_BLOCK_BYTES         = 400000;   // matches notes_blocks_size in 001_init.sql
const MAX_PREFS_BYTES         = 32768;    // matches user_prefs_size in 002
const MAX_IMAGE_BYTES         = 200000;   // matches user_prefs_image_size in 002
const MAX_TITLE               = 48;       // app.js truncates renames to the same
const FOLDER_MAX_DEPTH        = 12;       // mirrors FOLDER_MAX_DEPTH in app.js
const BLOCK_TYPES             = new Set(['text', 'code']);

// Postgres rejects JSON containing an unpaired UTF-16 surrogate outright ("invalid
// input syntax for type json"), and that error aborts the whole transaction — so ONE
// note with a broken character takes down the entire push, including every well-formed
// note batched with it. The realistic source isn't malice: `title.slice(0, 48)` splits
// an emoji straddling the cut, and that user's sync then fails forever.
function wellFormed(str) {
  const s = String(str);
  if (typeof s.toWellFormed === 'function') return s.toWellFormed();   // Node 20+
  // Replace a high surrogate not followed by a low one, or a low one not preceded by
  // a high one, with U+FFFD — exactly what toWellFormed does.
  return s.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    '\uFFFD'
  );
}

// Truncates by code point, so a cut never lands between the halves of a surrogate
// pair in the first place. `String.prototype.slice` counts UTF-16 units and will
// happily bisect an emoji.
function sliceCodePoints(str, max) {
  const cps = Array.from(String(str));
  return cps.length <= max ? String(str) : cps.slice(0, max).join('');
}

// jsonb stores numbers as `numeric` and prints them in full decimal, so 1e308 is six
// bytes to JSON.stringify and over three hundred to Postgres. Measuring the client-side
// string let a payload 20x its own budget through the size check and then fail
// user_prefs_size mid-transaction, taking that push's notes and folders with it.
// Nothing this app stores in prefs is legitimately outside this range.
// Both tails matter. jsonb prints `numeric` in full decimal, so 1e308 becomes ~316
// bytes AND 1e-300 becomes ~309 — a tiny number is six characters to JSON.stringify
// and just as ruinous to the column budget as a huge one. Guarding only the top was
// the first version of this fix, and it left the identical bug reachable from below.
const PREFS_MAX_ABS = 1e15;
const PREFS_MIN_ABS = 1e-6;
const PREFS_MAX_DEPTH = 8;

// Returns a copy with strings well-formed, or null if anything is unrepresentable.
// Rejecting beats coercing here: a silently mangled setting is worse than a refused one.
function sanitizeJsonTree(value, depth) {
  if (depth > PREFS_MAX_DEPTH) return null;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return wellFormed(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;          // NaN / ±Infinity aren't JSON
    if (value === 0) return 0;
    const mag = Math.abs(value);
    return (mag >= PREFS_MIN_ABS && mag <= PREFS_MAX_ABS) ? value : null;
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const v of value) {
      const clean = sanitizeJsonTree(v, depth + 1);
      if (clean === null && v !== null) return null;
      out.push(clean);
    }
    return out;
  }
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) {
      if (value[k] === undefined) continue;
      const clean = sanitizeJsonTree(value[k], depth + 1);
      if (clean === null && value[k] !== null) return null;
      out[wellFormed(k)] = clean;
    }
    return out;
  }
  return null;   // functions, symbols, bigint — not JSON
}

// Mirrors app.js's folderSegments, including its depth cap — that cap exists
// because an unbounded path recursed until the stack blew inside renderSidebar.
// Returns null for "top level", never '' , so it maps straight onto a nullable column.
function normalizeFolder(raw) {
  // Only a string (or a number, which a folder named "2026" legitimately is).
  // app.js does a bare String(folder || ''), which quietly turns an object into a
  // folder called "[object Object]" — fine as client sloppiness, not fine as the
  // value this server hands to a second device.
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const segs = wellFormed(raw)
    .split('/')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, FOLDER_MAX_DEPTH);
  const path = segs.join('/');
  // Belt and braces with notes_folder_shape: a segment of only control characters
  // would pass the trim above but fail the constraint and 500 the whole request.
  if (!path || path.length > 512) return null;
  return /^[^/\s][^/]*(\/[^/\s][^/]*)*$/.test(path) ? path : null;
}

function sanitizeBlocks(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const b of raw.slice(0, MAX_BLOCKS_PER_NOTE)) {
    if (!b || typeof b !== 'object') continue;
    const type = BLOCK_TYPES.has(b.type) ? b.type : 'text';
    // `lang` drives a highlight.js class name on the client. Constrain it to a
    // slug so it cannot become arbitrary markup by way of a class attribute.
    const lang = typeof b.lang === 'string' && /^[a-z0-9+#-]{1,24}$/i.test(b.lang) ? b.lang : null;
    out.push({ type, lang, content: typeof b.content === 'string' ? wellFormed(b.content) : '' });
  }
  if (Buffer.byteLength(JSON.stringify(out), 'utf8') > MAX_BLOCK_BYTES) return null;
  return out;
}

// A client id is opaque to us, but it is a UNIQUE key and appears in log lines,
// so bound it and keep it to characters app.js actually generates.
function normalizeNid(raw) {
  const nid = String(raw == null ? '' : raw).trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(nid) ? nid : null;
}

function normalizeSlug(raw, max) {
  const s = String(raw == null ? '' : raw).trim();
  return /^[a-z0-9-]{1,32}$/.test(s) && s.length <= max ? s : null;
}

// Returns a row-ready note, or null if it cannot be stored at all. Null is a
// skip, not an error: one unparseable note must not fail a whole sync and strand
// the other twenty-nine.
function sanitizeNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nid = normalizeNid(raw.nid);
  if (!nid) return null;
  const blocks = sanitizeBlocks(raw.blocks);
  if (!blocks) return null;
  const title = wellFormed(sliceCodePoints(String(raw.title == null ? '' : raw.title).trim(), MAX_TITLE)) || 'untitled';
  return {
    nid,
    blocks,
    title,
    titlePinned: raw.titlePinned === true,
    folder: normalizeFolder(raw.folder),
    theme: normalizeSlug(raw.theme, 32),
    font:  normalizeSlug(raw.font, 32),
  };
}

function sanitizeNotes(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const n of raw.slice(0, MAX_NOTES_PER_REQUEST)) {
    const note = sanitizeNote(n);
    // A duplicate nid in one payload would make the upsert hit the same row twice
    // in a single statement, which Postgres refuses outright ("cannot affect row a
    // second time"). Last one wins, matching last-write-wins everywhere else.
    if (!note) continue;
    if (seen.has(note.nid)) out[out.findIndex(x => x.nid === note.nid)] = note;
    else { seen.add(note.nid); out.push(note); }
  }
  return out;
}

function sanitizeFolders(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  for (const f of raw.slice(0, MAX_FOLDERS_PER_REQUEST)) {
    const path = normalizeFolder(typeof f === 'string' ? f : (f && f.path));
    if (path) seen.add(path);
  }
  return [...seen];
}

function sanitizeNids(raw) {
  if (!Array.isArray(raw)) return [];
  const out = new Set();
  for (const x of raw.slice(0, MAX_NOTES_PER_REQUEST)) {
    const nid = normalizeNid(typeof x === 'string' ? x : (x && x.nid));
    if (nid) out.add(nid);
  }
  return [...out];
}

// Prefs stay an open-ended bag (the client keeps hint dismissals, the tab list,
// save_before_new, sidebar geometry in there), so this validates size and type
// rather than fields. Oversize is rejected outright instead of truncated: a
// half-written prefs object is worse than the previous one.
function sanitizePrefs(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  // Uploaded wallpapers travel in their own column; leaving a copy here would blow the
  // 32KB budget the moment somebody uploads one — and the failure is invisible from
  // the client, which sees a 200 and never learns its prefs were dropped. That kills
  // theme, font, folders and tabs sync too, indefinitely.
  //
  // Stripped by SHAPE rather than by naming each surface: `sidebar` was the only one
  // when this was written, `mainBg` arrived later and reintroduced the same bug
  // verbatim. Anything with a `custom` data URI gets the same treatment, so a third
  // surface cannot repeat it a third time.
  //
  // At EVERY depth, not just the top. The one-level version held only while every
  // surface was a direct child of prefs; splitting home and notes moved them under
  // `surfaceBg`, which put the image two levels down and walked it straight back past
  // this guard. Recursing is what actually makes "by shape" true — the depth-based
  // escape was the fourth outing for this same bug.
  //
  // Arrays are walked too. Nothing in prefs nests an image inside one today, but the
  // whole reason this runs server-side is that the payload is attacker-shaped, and
  // skipping arrays would leave one uninspected hiding place.
  const stripCustom = (value, depth) => {
    if (depth > PREFS_MAX_DEPTH || !value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(v => stripCustom(v, depth + 1));
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripCustom(v, depth + 1);
    // Strip on the key being PRESENT, not on it holding a string. Requiring a string
    // left the original bug reachable through `custom: { nested: <40KB> }` — a shape
    // this app's own client never produces, but a hand-written PUT trivially does, and
    // guarding against exactly that is the point of doing this server-side at all.
    if ('custom' in out) out.custom = undefined;
    return out;
  };
  const safe = sanitizeJsonTree(stripCustom(raw, 0), 0);
  if (safe === null) return null;
  const json = JSON.stringify(safe);
  if (Buffer.byteLength(json, 'utf8') > MAX_PREFS_BYTES) return null;
  return JSON.parse(json);   // round-trip drops undefined and any non-JSON values
}

function sanitizeImage(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw);
  if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s)) return null;
  if (Buffer.byteLength(s, 'utf8') > MAX_IMAGE_BYTES) return null;
  return s;
}

// ── Row → wire ───────────────────────────────────────────────────────────────
// `t` is the row's updated_at as epoch ms, because that is the field the client's
// mergeRecents already sorts on. Note it is the SERVER's clock: a device with a
// wrong clock can no longer win a merge it should have lost.
function rowToNote(row) {
  return {
    nid:         row.client_nid,
    blocks:      row.blocks,
    title:       row.title,
    titlePinned: row.title_pinned,
    folder:      row.folder || null,
    theme:       row.theme || null,
    font:        row.font || null,
    t:           Number(row.updated_at_ms),
    deleted:     row.deleted_at != null,
  };
}

function rowToFolder(row) {
  return { path: row.path, t: Number(row.updated_at_ms), deleted: row.deleted_at != null };
}

module.exports = {
  wellFormed, sliceCodePoints,
  normalizeFolder, normalizeNid, sanitizeBlocks, sanitizeNote, sanitizeNotes,
  sanitizeFolders, sanitizeNids, sanitizePrefs, sanitizeImage,
  rowToNote, rowToFolder,
  MAX_NOTES_PER_REQUEST, MAX_BLOCK_BYTES, MAX_PREFS_BYTES, MAX_IMAGE_BYTES, FOLDER_MAX_DEPTH,
};
