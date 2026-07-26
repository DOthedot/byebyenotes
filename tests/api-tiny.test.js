// Unit-tests api/tiny.js by driving the Vercel handler with a mock (req, res) and a
// mocked KV REST endpoint (global.fetch). The handler reads env at module load, so each
// case re-requires it via load() after setting process.env.

function mockRes() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    send(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}
const load = () => { jest.resetModules(); return require('../api/tiny.js'); };

describe('api/tiny', () => {
  const OLD = process.env;
  beforeEach(() => {
    process.env = { ...OLD, KV_REST_API_URL: 'http://kv', KV_REST_API_TOKEN: 't' };
  });
  afterEach(() => { process.env = OLD; delete global.fetch; });

  test('503 when KV not configured', async () => {
    process.env = { ...OLD };
    delete process.env.KV_REST_API_URL; delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.KV_REST_API_TOKEN; delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const res = mockRes();
    await load()({ method: 'POST', body: { hash: 'x', ttl: 60 } }, res);
    expect(res.statusCode).toBe(503);
  });

  test('POST rejects a ttl not in the allowed set', async () => {
    const res = mockRes();
    await load()({ method: 'POST', body: { hash: 'abc', ttl: 12345 } }, res);
    expect(res.statusCode).toBe(400);
  });

  test('POST stores the hash with a Redis TTL and returns an id', async () => {
    let sent;
    global.fetch = async (_url, opts) => { sent = JSON.parse(opts.body); return { ok: true, json: async () => ({ result: 'OK' }) }; };
    const res = mockRes();
    await load()({ method: 'POST', body: { hash: 'HASH', ttl: 86400 } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toMatch(/^[a-z0-9]{6,12}$/);
    expect(sent[0]).toBe('SET');
    expect(sent[1]).toBe(`tiny:${res.body.id}`);
    expect(sent[2]).toBe('HASH');
    expect(sent[3]).toBe('EX');
    expect(sent[4]).toBe(86400);
  });

  test('POST rejects an oversized hash', async () => {
    const res = mockRes();
    await load()({ method: 'POST', body: { hash: 'x'.repeat(200001), ttl: 60 } }, res);
    expect(res.statusCode).toBe(413);
  });

  test('GET unknown id returns 404', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ result: null }) });
    const res = mockRes();
    await load()({ method: 'GET', query: { id: 'abcdef' } }, res);
    expect(res.statusCode).toBe(404);
  });

  test('GET known id returns the stored hash', async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ result: 'STORED' }) });
    const res = mockRes();
    await load()({ method: 'GET', query: { id: 'abcdef' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.hash).toBe('STORED');
  });

  test('GET bad id returns 400', async () => {
    const res = mockRes();
    await load()({ method: 'GET', query: { id: 'no' } }, res);
    expect(res.statusCode).toBe(400);
  });

  test('unsupported method returns 405', async () => {
    const res = mockRes();
    await load()({ method: 'DELETE', query: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});
