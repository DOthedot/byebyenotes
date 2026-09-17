// Pasted-image store — the client compresses, POSTs base64, gets an id; GET serves the
// bytes. The markdown only ever holds `/api/img?id=…`, never the image itself.
//
// Postgres, not Redis: an image is permanent, and an in-memory store with an eviction
// policy would punch holes in notes. Schema: migrations/003_images.sql.
//
// Uploading needs a sync key; viewing does not. An upload writes to the database that
// holds everyone's notes, so it must belong to an account — which gives the quota
// something to count and lets ON DELETE CASCADE clean up. Viewing stays public because
// a shared note has to render for someone who has never signed in.

const db    = require('./db');
const store = require('./notes-store');
const { randomId } = require('./ids');
const { resolveUser, AuthError } = require('./auth');

const ID_RE             = /^[a-z0-9]{8,16}$/;   // matches the id CHECK in 003_images.sql
const ID_LENGTH         = 12;
const IMAGE_QUOTA_BYTES = 50 * 1024 * 1024;

// One statement, so the quota check and the insert run against the same snapshot.
// Under READ COMMITTED two concurrent uploads can both pass the sum; the overshoot is
// bounded by the images in flight, which is accepted. Every parameter is cast so no
// type depends on inference from an INSERT … SELECT list.
const INSERT_SQL = `
  INSERT INTO images (id, user_id, mime, bytes)
  SELECT $1::text, $2::uuid, $3::text, $4::bytea
  WHERE (SELECT coalesce(sum(byte_size), 0) FROM images WHERE user_id = $2::uuid)
        + $5::bigint <= $6::bigint
  RETURNING id`;

// Returns the stored id, or null when the quota guard refused the row.
async function insertImage(userId, mime, bytes) {
  for (let attempt = 0; ; attempt++) {
    const id = randomId(ID_LENGTH);
    try {
      const res = await db.query(INSERT_SQL, [id, userId, mime, bytes, bytes.length, IMAGE_QUOTA_BYTES]);
      return res.rowCount ? id : null;
    } catch (e) {
      // 36^12 ids make a collision all but impossible; one retry covers it without
      // looping forever on a genuine constraint problem.
      if (e.code === '23505' && attempt === 0) continue;
      throw e;
    }
  }
}

async function upload(req, res) {
  let userId;
  try {
    userId = await resolveUser(req.headers && req.headers['x-sync-key']);
  } catch (e) {
    if (e instanceof AuthError) return res.status(e.status).json({ error: e.message });
    throw e;
  }

  const image = store.sanitizeUpload(req.body);
  if (!image.ok) {
    return res.status(image.reason === 'too large' ? 413 : 400).json({ error: image.reason });
  }

  const id = await insertImage(userId, image.mime, image.bytes);
  if (!id) return res.status(413).json({ error: 'quota exceeded' });
  return res.status(200).json({ id });
}

async function serve(req, res) {
  if (!db.isConfigured()) return res.status(503).json({ error: 'image store not configured' });

  const id = req.query && req.query.id;
  if (!ID_RE.test(id || '')) return res.status(400).json({ error: 'bad id' });

  const found = await db.query('SELECT mime, bytes FROM images WHERE id = $1', [id]);
  if (!found.rowCount) return res.status(404).json({ error: 'not found' });

  const { mime, bytes } = found.rows[0];
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  // The mime comes from an allowlist, but nosniff guarantees no browser second-guesses
  // uploaded bytes into something executable served from this origin.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(200).send(bytes);
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET')  return await serve(req, res);
    if (req.method === 'POST') return await upload(req, res);
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    // The code is the useful part when a row slips past validation into a CHECK.
    console.error('img failed:', e.code || '', e.message);
    return res.status(502).json({ error: 'database unavailable' });
  }
};
