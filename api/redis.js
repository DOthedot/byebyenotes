// Redis connection, shared by every handler that needs one. Today that is only
// api/tiny.js: short links are the one thing on this server that is fine to lose.
//
// Railway Redis speaks RESP over TCP, so this is a real client rather than the
// fetch-based Upstash REST calls it replaced. On Railway, REDIS_URL is the reference
// variable ${{Redis.REDIS_URL}}, which resolves to the private-network address.
//
// The contract callers rely on is FAIL FAST. A link that cannot be stored costs the
// user nothing — the share panel falls back to the full-hash URL — but a request that
// hangs on a dead Redis costs them a frozen share panel. So:
//   * disableOfflineQueue: commands issued while disconnected reject instead of
//     queueing in memory until the socket comes back;
//   * a call waits at most READY_TIMEOUT_MS for a connection, then throws.

const { createClient } = require('redis');

const READY_TIMEOUT_MS = 1000;

let client = null;

function isConfigured() {
  return Boolean(process.env.REDIS_URL);
}

function getClient() {
  if (client) return client;
  client = createClient({
    url: process.env.REDIS_URL,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 5000,
      // Keep retrying forever, at most 2s apart. Returning an Error here closes the
      // client for good, and one Redis restart must not require an app restart.
      reconnectStrategy: (retries) => Math.min(2 ** retries * 50, 2000),
    },
  });
  // An EventEmitter 'error' with no listener throws, which would take the whole
  // server down over a Redis blip. Logging is enough; the client reconnects itself.
  client.on('error', (err) => console.error('redis error:', err.message));
  client.connect().catch((err) => console.error('redis connect failed:', err.message));
  return client;
}

async function ready() {
  if (!isConfigured()) throw new Error('redis not configured');
  const c = getClient();
  if (c.isReady) return c;
  // No await between the isReady check and attaching the listener, so a 'ready'
  // event cannot slip in between the two.
  await new Promise((resolve, reject) => {
    const onReady = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => {
      c.off('ready', onReady);
      reject(new Error('redis not ready'));
    }, READY_TIMEOUT_MS);
    c.once('ready', onReady);
  });
  return c;
}

async function get(key) {
  return (await ready()).get(key);
}

// SET … NX never overwrites. A null reply is Redis saying the key already exists,
// which for a freshly generated id means a collision the caller should retry.
async function setIfAbsent(key, value, ttlSeconds) {
  const reply = await (await ready()).set(key, value, { EX: ttlSeconds, NX: true });
  return reply === 'OK';
}

module.exports = { isConfigured, get, setIfAbsent, READY_TIMEOUT_MS };
