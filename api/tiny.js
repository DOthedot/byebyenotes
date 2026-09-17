// Tiny share URLs — the client POSTs the note's LZ hash + a ttl and gets a short id;
// GET returns the stored hash. Redis TTL (EX) auto-deletes the entry on expiry, so links
// disappear from the store on their own.
//
// Backed by Railway Redis through api/redis.js. That Redis holds nothing but these
// links, which is what makes an evicting maxmemory policy safe there: losing a link
// early costs a reshare, never a note.

const redis = require('./redis');
const { randomId } = require('./ids');

const ID_RE       = /^[a-z0-9]{6,12}$/;
const ID_LENGTH   = 8;
const ID_ATTEMPTS = 3;                                   // 36^8 ids; a third collision means something else is wrong
const TTLS        = new Set([60, 1800, 21600, 86400]);   // 1min, 30min, 6hr, 24hr
const MAX_HASH    = 200000;                              // compressed note hash, generous cap

module.exports = async (req, res) => {
  if (!redis.isConfigured()) {
    return res.status(503).json({ error: 'tiny url not configured' });
  }

  try {
    if (req.method === 'GET') {
      const id = req.query && req.query.id;
      if (!ID_RE.test(id || '')) return res.status(400).json({ error: 'bad id' });
      const hash = await redis.get(`tiny:${id}`);
      if (!hash) return res.status(404).json({ error: 'not found' });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ hash });
    }

    if (req.method === 'POST') {
      const { hash, ttl } = req.body || {};
      if (typeof hash !== 'string' || !hash || !TTLS.has(ttl)) {
        return res.status(400).json({ error: 'bad request' });
      }
      if (hash.length > MAX_HASH) return res.status(413).json({ error: 'too large' });
      // SET NX never overwrites, so a colliding id is detected and retried rather than
      // silently replacing someone else's live link with this note.
      for (let attempt = 0; attempt < ID_ATTEMPTS; attempt++) {
        const id = randomId(ID_LENGTH);
        if (await redis.setIfAbsent(`tiny:${id}`, hash, ttl)) {
          return res.status(200).json({ id, ttl });
        }
      }
      return res.status(502).json({ error: 'could not allocate an id' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('tiny failed:', e.message);
    return res.status(502).json({ error: 'redis unavailable' });
  }
};
