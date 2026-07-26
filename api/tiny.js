// Tiny share URLs — the client POSTs the note's LZ hash + a ttl and gets a short id;
// GET returns the stored hash. Redis TTL (EX) auto-deletes the entry on expiry, so links
// disappear from the store on their own. Backed by the same Upstash/Vercel KV as img/sync.

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const ID_RE    = /^[a-z0-9]{6,12}$/;
const TTLS     = new Set([60, 1800, 21600, 86400]);   // 1min, 30min, 6hr, 24hr
const MAX_HASH = 200000;                              // compressed note hash, generous cap

async function kv(command) {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`kv ${res.status}`);
  return (await res.json()).result;
}

module.exports = async (req, res) => {
  if (!KV_URL || !KV_TOKEN) {
    return res.status(503).json({ error: 'tiny url not configured' });
  }

  try {
    if (req.method === 'GET') {
      const id = req.query.id;
      if (!ID_RE.test(id || '')) return res.status(400).json({ error: 'bad id' });
      const hash = await kv(['GET', `tiny:${id}`]);
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
      const id = Math.random().toString(36).slice(2, 9);
      await kv(['SET', `tiny:${id}`, hash, 'EX', ttl]);
      return res.status(200).json({ id, ttl });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(502).json({ error: 'kv unavailable' });
  }
};
