// Sync store — Postgres rows, one set per user.
//
// This replaced a single KV value per passphrase. That design had two limits that
// were not fixable at the storage layer:
//
//   * One 400KB budget for everything. A 120KB wallpaper took a third of it, and
//     the failure mode was a 413 that told the user to "remove some notes".
//   * Deletion could not be expressed. The blob was a full list, and a note
//     deleted on one device was merely ABSENT from that device's list — absence
//     carries no timestamp, so the other device's copy always won and the note
//     came back. Rows carry deleted_at, which does.
//
// The wire format is deliberately close to what app.js already holds, but notes
// travel as `blocks`, not as the LZ-String hash. The hash is a URL serialization
// and the client re-derives it on load; storing it too would mean two copies of
// the same note that can disagree.
//
// Auth is api/auth.js: the browser sends SHA-256 of the passphrase, never the
// phrase. Unchanged from the KV version.

const db    = require('./db');
const store = require('./notes-store');
const { resolveUser, AuthError } = require('./auth');

// A PAGE SIZE, not a ceiling. pull() returns a nextCursor whenever a page comes back
// full and the client walks every page, so an account with more rows than this no
// longer loses the remainder in silence — which is what Import would have made routine.
//
// Still bounded per request for the original reason: one enormous account must not
// hold a connection open while it streams everything it has.
//
// It is no longer tied to the client's SNAP_MAX, and deliberately so. That coupling
// existed only while a push sent every snapshot in ONE request, where a client cap
// above this number meant notes sliced away server-side with nothing to show for it.
// Batching removed it: the client now holds far more than this (1000 at the time of
// writing) and sends it in pieces this size.
//
// Worth keeping in view: an account accumulates rows that no device still has.
// saveSnapshot evicts its oldest note without tombstoning it — deleteSnapshot is the
// only path that ever does — so every note a device created is still a row here, and
// push upserts without trimming. Paging is what makes those reachable again rather
// than merely present.
const PULL_LIMIT = 200;

// Old tombstones are dropped from the pull: past this, every device has long
// since seen the delete, and carrying them forever would grow every response.
const TOMBSTONE_WINDOW = '90 days';

// The millisecond form of updated_at, defined ONCE. The cursor is built from this
// value, the keyset compares against it, and the ORDER BY sorts on it — if any of the
// three used a different expression the boundary would be lossy, which is how the
// first version of this pagination silently dropped whole push batches.
const UPDATED_MS = `(extract(epoch from updated_at) * 1000)::bigint`;

const NOTE_COLS = `
  client_nid, blocks, title, title_pinned, folder, theme, font, deleted_at,
  ${UPDATED_MS} AS updated_at_ms`;

async function pull(userId, since, cursor) {
  const sinceClause = since ? 'AND updated_at > to_timestamp($2 / 1000.0)' : '';
  const params = since ? [userId, since] : [userId];

  // Live notes are the only unbounded set — an account accumulates them and nothing
  // trims. Tombstones are bounded by TOMBSTONE_WINDOW and folders by how many a person
  // will plausibly make, so those keep their flat cap; if either ever needs paging it
  // will be for a different reason than this.
  // Paged on the MILLISECOND expression, not on updated_at itself, and the same
  // expression appears in the cursor, the comparison and the ORDER BY.
  //
  // This matters more than it looks. updated_at is microsecond precision; the cursor
  // can only carry milliseconds, because it round-trips through a JS number and Date
  // has no finer resolution. Comparing a rounded boundary against the raw column —
  // `updated_at < to_timestamp(ms / 1000.0)` — is lossy in a way that loses notes: the
  // trigger sets updated_at from now(), which is fixed for a whole transaction, so
  // every row in one push batch shares a timestamp, and whenever that timestamp's
  // sub-millisecond part rounds DOWN the siblings all fail the comparison and vanish
  // from the pull for good. Roughly half of all batches. Rounding both sides
  // identically removes the mismatch entirely.
  const cur = store.decodeCursor(cursor);
  const liveParams = params.slice();
  let keyset = '';
  if (cur) {
    liveParams.push(cur.ms, cur.nid);
    const a = '$' + (liveParams.length - 1), b = '$' + liveParams.length;
    // Row comparison against the same expression the cursor was built from, so the
    // boundary is exclusive and a tie is broken the same way in both places.
    keyset = `AND (${UPDATED_MS}, client_nid) < (${a}::bigint, ${b})`;
  }

  // Ordering on the expression means notes_user_recent_idx (user_id, updated_at DESC)
  // no longer satisfies the sort, so Postgres sorts the user's live notes. Bounded by
  // how many notes one account has and fine at the sizes this app holds. An expression
  // index on (user_id, MS DESC, client_nid DESC) would remove the sort, but migrations/
  // needs sign-off, so it is a follow-up rather than a silent addition here.
  const [live, dead, folders, prefs] = await Promise.all([
    db.query(
      `SELECT ${NOTE_COLS} FROM notes
       WHERE user_id = $1 AND deleted_at IS NULL ${sinceClause} ${keyset}
       ORDER BY ${UPDATED_MS} DESC, client_nid DESC LIMIT ${PULL_LIMIT}`, liveParams),
    db.query(
      `SELECT ${NOTE_COLS} FROM notes
       WHERE user_id = $1 AND deleted_at > now() - interval '${TOMBSTONE_WINDOW}' ${sinceClause}
       ORDER BY deleted_at DESC LIMIT ${PULL_LIMIT}`, params),
    db.query(
      `SELECT path, deleted_at, (extract(epoch from updated_at) * 1000)::bigint AS updated_at_ms
       FROM folders
       WHERE user_id = $1 AND (deleted_at IS NULL OR deleted_at > now() - interval '${TOMBSTONE_WINDOW}')
       ORDER BY path LIMIT ${PULL_LIMIT}`, [userId]),
    db.query('SELECT prefs, sidebar_image FROM user_prefs WHERE user_id = $1', [userId]),
  ]);

  // A full page means there may be more. One extra empty request when the total is an
  // exact multiple of PULL_LIMIT is the price of not counting rows separately, and it
  // is the safe direction to err: a client that stops early loses notes silently,
  // which is the bug this pagination exists to remove.
  const nextCursor = live.rows.length === PULL_LIMIT
    ? store.encodeCursor(live.rows[live.rows.length - 1])
    : null;

  return {
    notes:        live.rows.map(store.rowToNote),
    deletedNotes: dead.rows.map(store.rowToNote),
    folders:      folders.rows.map(store.rowToFolder),
    prefs:        prefs.rowCount ? prefs.rows[0].prefs : null,
    sidebarImage: prefs.rowCount ? prefs.rows[0].sidebar_image : null,
    serverTime:   Date.now(),
    nextCursor,
  };
}

async function push(userId, body) {
  const notes          = store.sanitizeNotes(body.notes);
  const deletedNotes   = store.sanitizeNids(body.deletedNotes);
  const folders        = store.sanitizeFolders(body.folders);
  const deletedFolders = store.sanitizeFolders(body.deletedFolders);
  const prefs          = store.sanitizePrefs(body.prefs);
  const hasImage       = Object.prototype.hasOwnProperty.call(body, 'sidebarImage');

  const counts = { notes: 0, deletedNotes: 0, folders: 0, deletedFolders: 0, prefs: false };

  await db.transaction(async (client) => {
    if (notes.length) {
      // UNNEST rather than a built VALUES list: one prepared statement whatever the
      // batch size, and no string concatenation anywhere near user content.
      const res = await client.query(
        `INSERT INTO notes (user_id, client_nid, blocks, title, title_pinned, folder, theme, font)
         SELECT $1, n.nid, n.blocks, n.title, n.pinned, n.folder, n.theme, n.font
         FROM unnest($2::text[], $3::jsonb[], $4::text[], $5::boolean[], $6::text[], $7::text[], $8::text[])
              AS n(nid, blocks, title, pinned, folder, theme, font)
         ON CONFLICT (user_id, client_nid) DO UPDATE SET
           blocks       = EXCLUDED.blocks,
           title        = EXCLUDED.title,
           title_pinned = EXCLUDED.title_pinned,
           folder       = EXCLUDED.folder,
           theme        = EXCLUDED.theme,
           font         = EXCLUDED.font
         WHERE notes.deleted_at IS NULL
           AND (notes.blocks       IS DISTINCT FROM EXCLUDED.blocks
             OR notes.title        IS DISTINCT FROM EXCLUDED.title
             OR notes.title_pinned IS DISTINCT FROM EXCLUDED.title_pinned
             OR notes.folder       IS DISTINCT FROM EXCLUDED.folder
             OR notes.theme        IS DISTINCT FROM EXCLUDED.theme
             OR notes.font         IS DISTINCT FROM EXCLUDED.font)`,
        [
          userId,
          notes.map(n => n.nid),
          notes.map(n => JSON.stringify(n.blocks)),
          notes.map(n => n.title),
          notes.map(n => n.titlePinned),
          notes.map(n => n.folder),
          notes.map(n => n.theme),
          notes.map(n => n.font),
        ]
      );
      counts.notes = res.rowCount;
    }

    if (deletedNotes.length) {
      const res = await client.query(
        `UPDATE notes SET deleted_at = now()
         WHERE user_id = $1 AND client_nid = ANY($2::text[]) AND deleted_at IS NULL`,
        [userId, deletedNotes]);
      counts.deletedNotes = res.rowCount;
    }

    if (folders.length) {
      const res = await client.query(
        `INSERT INTO folders (user_id, path)
         SELECT $1, p FROM unnest($2::text[]) AS p
         ON CONFLICT (user_id, path) DO UPDATE SET deleted_at = NULL
         WHERE folders.deleted_at IS NOT NULL`,
        [userId, folders]);
      counts.folders = res.rowCount;
    }

    if (deletedFolders.length) {
      const res = await client.query(
        `UPDATE folders SET deleted_at = now()
         WHERE user_id = $1 AND path = ANY($2::text[]) AND deleted_at IS NULL`,
        [userId, deletedFolders]);
      counts.deletedFolders = res.rowCount;
    }

    if (prefs) {
      // Guarded by the client's own `t` stamp so a laggy device replaying an old
      // prefs blob cannot roll back a newer one. jsonb_typeof first, because a
      // bare ->>'t' cast on a non-number aborts the whole transaction.
      const res = await client.query(
        `INSERT INTO user_prefs (user_id, prefs) VALUES ($1, $2::jsonb)
         ON CONFLICT (user_id) DO UPDATE SET prefs = EXCLUDED.prefs
         WHERE COALESCE(CASE WHEN jsonb_typeof(EXCLUDED.prefs->'t') = 'number'
                             THEN (EXCLUDED.prefs->>'t')::numeric END, 0)
            >= COALESCE(CASE WHEN jsonb_typeof(user_prefs.prefs->'t') = 'number'
                             THEN (user_prefs.prefs->>'t')::numeric END, 0)`,
        [userId, JSON.stringify(prefs)]);
      counts.prefs = res.rowCount > 0;
    }

    if (hasImage) {
      // Absent means "leave it alone"; explicit null means "clear it". Without that
      // distinction every ordinary sync from a device would wipe the wallpaper,
      // because the client does not carry the image in its normal push.
      await client.query(
        `INSERT INTO user_prefs (user_id, sidebar_image) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET sidebar_image = EXCLUDED.sidebar_image`,
        [userId, store.sanitizeImage(body.sidebarImage)]);
    }
  });

  return counts;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  let userId;
  try {
    userId = await resolveUser(req.headers['x-sync-key']);
  } catch (e) {
    if (e instanceof AuthError) return res.status(e.status).json({ error: e.message });
    console.error('sync auth failed:', e.message);
    return res.status(503).json({ error: 'sync unavailable' });
  }

  try {
    if (req.method === 'GET') {
      const raw = req.query && req.query.since;
      const since = Number(raw);
      // decodeCursor validates; anything unparseable is treated as absent, so a stale
      // or mangled cursor restarts the pull rather than failing it.
      const cursor = (req.query && typeof req.query.cursor === 'string') ? req.query.cursor : null;
      return res.status(200).json({
        data: await pull(userId, Number.isFinite(since) && since > 0 ? since : null, cursor),
      });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({ error: 'bad body' });
      }
      return res.status(200).json({ ok: true, ...(await push(userId, body)) });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    // The constraint name is the useful part when a payload slips past
    // notes-store.js — a bare "database unavailable" hides a real shape bug.
    console.error('sync failed:', e.constraint || e.code || '', e.message);
    return res.status(502).json({ error: 'database unavailable' });
  }
};

module.exports.pull = pull;
module.exports.push = push;
