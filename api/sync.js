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

// A pull is bounded so one enormous account cannot hold a connection open
// indefinitely. 200 live notes is well past the client's own SNAP_MAX of 30.
const PULL_LIMIT = 200;

// Old tombstones are dropped from the pull: past this, every device has long
// since seen the delete, and carrying them forever would grow every response.
const TOMBSTONE_WINDOW = '90 days';

const NOTE_COLS = `
  client_nid, blocks, title, title_pinned, folder, theme, font, deleted_at,
  (extract(epoch from updated_at) * 1000)::bigint AS updated_at_ms`;

async function pull(userId, since) {
  const sinceClause = since ? 'AND updated_at > to_timestamp($2 / 1000.0)' : '';
  const params = since ? [userId, since] : [userId];

  const [live, dead, folders, prefs] = await Promise.all([
    db.query(
      `SELECT ${NOTE_COLS} FROM notes
       WHERE user_id = $1 AND deleted_at IS NULL ${sinceClause}
       ORDER BY updated_at DESC LIMIT ${PULL_LIMIT}`, params),
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

  return {
    notes:        live.rows.map(store.rowToNote),
    deletedNotes: dead.rows.map(store.rowToNote),
    folders:      folders.rows.map(store.rowToFolder),
    prefs:        prefs.rowCount ? prefs.rows[0].prefs : null,
    sidebarImage: prefs.rowCount ? prefs.rows[0].sidebar_image : null,
    serverTime:   Date.now(),
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
      return res.status(200).json({
        data: await pull(userId, Number.isFinite(since) && since > 0 ? since : null),
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
