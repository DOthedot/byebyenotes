/**
 * @jest-environment node
 *
 * api/tiny.js — short share links. api/redis.js is mocked, so these pin the handler's
 * contract (validation, collision-safe id allocation, fail-soft statuses) without a
 * live Redis. api/ids.js is real.
 */
jest.mock('../api/redis', () => ({
  isConfigured: jest.fn(),
  get: jest.fn(),
  setIfAbsent: jest.fn(),
}));

const redis = require('../api/redis');
const handler = require('../api/tiny.js');

function mockRes() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    send(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

const ID = /^[a-z0-9]{6,12}$/;
const post = (body) => ({ method: 'POST', body });
const get = (id) => ({ method: 'GET', query: { id } });

describe('api/tiny', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    redis.isConfigured.mockReturnValue(true);
  });

  test('503 when Redis is not configured', async () => {
    redis.isConfigured.mockReturnValue(false);
    const res = mockRes();
    await handler(post({ hash: 'x', ttl: 60 }), res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'tiny url not configured' });
    expect(redis.setIfAbsent).not.toHaveBeenCalled();
  });

  test('POST rejects a ttl not in the allowed set', async () => {
    const res = mockRes();
    await handler(post({ hash: 'abc', ttl: 12345 }), res);
    expect(res.statusCode).toBe(400);
  });

  test('POST rejects a missing hash', async () => {
    const res = mockRes();
    await handler(post({ ttl: 60 }), res);
    expect(res.statusCode).toBe(400);
  });

  test('POST rejects an oversized hash', async () => {
    const res = mockRes();
    await handler(post({ hash: 'x'.repeat(200001), ttl: 60 }), res);
    expect(res.statusCode).toBe(413);
    expect(redis.setIfAbsent).not.toHaveBeenCalled();
  });

  test('POST stores the hash under tiny:<id> with its ttl and returns the id', async () => {
    redis.setIfAbsent.mockResolvedValue(true);
    const res = mockRes();
    await handler(post({ hash: 'HASH', ttl: 86400 }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toMatch(ID);
    expect(res.body.ttl).toBe(86400);
    expect(redis.setIfAbsent).toHaveBeenCalledWith(`tiny:${res.body.id}`, 'HASH', 86400);
  });

  test('POST retries with a fresh id when the first one is taken', async () => {
    redis.setIfAbsent.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const res = mockRes();
    await handler(post({ hash: 'HASH', ttl: 60 }), res);
    expect(res.statusCode).toBe(200);
    expect(redis.setIfAbsent).toHaveBeenCalledTimes(2);
    const [first, second] = redis.setIfAbsent.mock.calls.map(c => c[0]);
    expect(first).not.toBe(second);
    expect(second).toBe(`tiny:${res.body.id}`);
  });

  test('POST gives up with 502 after three collisions', async () => {
    redis.setIfAbsent.mockResolvedValue(false);
    const res = mockRes();
    await handler(post({ hash: 'HASH', ttl: 60 }), res);
    expect(res.statusCode).toBe(502);
    expect(redis.setIfAbsent).toHaveBeenCalledTimes(3);
  });

  test('POST returns 502 when Redis throws', async () => {
    redis.setIfAbsent.mockRejectedValue(new Error('redis not ready'));
    const res = mockRes();
    await handler(post({ hash: 'HASH', ttl: 60 }), res);
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'redis unavailable' });
  });

  test('GET bad id returns 400', async () => {
    const res = mockRes();
    await handler(get('no'), res);
    expect(res.statusCode).toBe(400);
    expect(redis.get).not.toHaveBeenCalled();
  });

  test('GET unknown id returns 404', async () => {
    redis.get.mockResolvedValue(null);
    const res = mockRes();
    await handler(get('abcdef'), res);
    expect(res.statusCode).toBe(404);
    expect(redis.get).toHaveBeenCalledWith('tiny:abcdef');
  });

  test('GET known id returns the stored hash, uncached', async () => {
    redis.get.mockResolvedValue('STORED');
    const res = mockRes();
    await handler(get('abcdef'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ hash: 'STORED' });
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  test('GET returns 502 when Redis throws', async () => {
    redis.get.mockRejectedValue(new Error('redis not ready'));
    const res = mockRes();
    await handler(get('abcdef'), res);
    expect(res.statusCode).toBe(502);
  });

  test('unsupported method returns 405', async () => {
    const res = mockRes();
    await handler({ method: 'DELETE', query: {} }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET, POST');
  });
});
