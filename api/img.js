// Image store — client compresses, POSTs base64, gets an id; GET serves the bytes.
// Backed by the same Upstash/Vercel KV as sync.

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const ID_RE       = /^[a-z0-9]{8,16}$/;
const TYPES       = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_B64     = 500000;   // ~375KB of image — plenty after client-side compression

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
    return res.status(503).json({ error: 'image store not configured' });
  }

  try {
    if (req.method === 'GET') {
      const id = req.query.id;
      if (!ID_RE.test(id || '')) return res.status(400).json({ error: 'bad id' });
      const raw = await kv(['GET', `img:${id}`]);
      if (!raw) return res.status(404).json({ error: 'not found' });
      const { t, d } = JSON.parse(raw);
      res.setHeader('Content-Type', t);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(Buffer.from(d, 'base64'));
    }

    if (req.method === 'POST') {
      const { type, data } = req.body || {};
      if (!TYPES.has(type) || typeof data !== 'string' || !data) {
        return res.status(400).json({ error: 'bad image' });
      }
      if (data.length > MAX_B64) return res.status(413).json({ error: 'too large' });
      const id = Math.random().toString(36).slice(2, 12);
      await kv(['SET', `img:${id}`, JSON.stringify({ t: type, d: data })]);
      return res.status(200).json({ id });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(502).json({ error: 'kv unavailable' });
  }
};
