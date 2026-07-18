// Sync store — one KV blob per passphrase-derived key.
// The client sends SHA-256(passphrase) as x-sync-key; the raw phrase never leaves the browser.
// Works with Vercel KV / Upstash Redis REST env vars (either naming scheme).

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const KEY_RE      = /^[0-9a-f]{64}$/;
const MAX_RECENTS = 60;
const MAX_BYTES   = 400000;

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
  res.setHeader('Cache-Control', 'no-store');

  if (!KV_URL || !KV_TOKEN) {
    return res.status(503).json({ error: 'sync not configured — add a KV store to this Vercel project' });
  }

  const key = req.headers['x-sync-key'];
  if (!KEY_RE.test(key || '')) return res.status(400).json({ error: 'bad key' });
  const storeKey = `bbn:${key}`;

  try {
    if (req.method === 'GET') {
      const raw = await kv(['GET', storeKey]);
      return res.status(200).json({ data: raw ? JSON.parse(raw) : null });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const { recents, prefs } = req.body || {};
      if (!Array.isArray(recents) || recents.length > MAX_RECENTS) {
        return res.status(400).json({ error: 'bad recents' });
      }
      const json = JSON.stringify({
        recents,
        prefs: prefs && typeof prefs === 'object' ? prefs : {},
        updatedAt: Date.now(),
      });
      if (json.length > MAX_BYTES) return res.status(413).json({ error: 'too large' });
      await kv(['SET', storeKey, json]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(502).json({ error: 'kv unavailable' });
  }
};
