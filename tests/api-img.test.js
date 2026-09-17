/**
 * @jest-environment node
 *
 * api/img.js — pasted images in Postgres. db and auth are mocked; notes-store and ids
 * are real, so validation and id format are exercised as shipped.
 *
 * The contract: an upload belongs to a sync account and respects a 50 MB quota;
 * viewing is public, because a shared note must render for someone never signed in.
 */
jest.mock('../api/db', () => ({ isConfigured: jest.fn(), query: jest.fn() }));
jest.mock('../api/auth', () => {
  class AuthError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }
  return { AuthError, resolveUser: jest.fn() };
});

const db = require('../api/db');
const { AuthError, resolveUser } = require('../api/auth');
const handler = require('../api/img.js');

const USER = '00000000-0000-4000-8000-000000000001';
const KEY  = 'a'.repeat(64);
const PNG  = Buffer.from('not really a png').toString('base64');   // 16 bytes

function mockRes() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
    send(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

const post = (body, headers = { 'x-sync-key': KEY }) => ({ method: 'POST', headers, body });
const get  = (id) => ({ method: 'GET', headers: {}, query: { id } });

describe('api/img POST', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    db.isConfigured.mockReturnValue(true);
    resolveUser.mockResolvedValue(USER);
  });

  test('passes a bad-key AuthError through with its status', async () => {
    resolveUser.mockRejectedValue(new AuthError(400, 'bad key'));
    const res = mockRes();
    await handler(post({ type: 'image/png', data: PNG }, {}), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'bad key' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('passes a rejected-key AuthError through as 403', async () => {
    resolveUser.mockRejectedValue(new AuthError(403, 'key rejected'));
    const res = mockRes();
    await handler(post({ type: 'image/png', data: PNG }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'key rejected' });
  });

  test('rejects a disallowed type with 400 bad image, without touching the table', async () => {
    const res = mockRes();
    await handler(post({ type: 'image/svg+xml', data: PNG }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'bad image' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('rejects an oversized upload with 413 too large', async () => {
    const res = mockRes();
    await handler(post({ type: 'image/png', data: 'A'.repeat(500004) }), res);
    expect(res.statusCode).toBe(413);
    expect(res.body).toEqual({ error: 'too large' });
  });

  test('stores decoded bytes under the caller and returns the new id', async () => {
    db.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 'ignored' }] });
    const res = mockRes();
    await handler(post({ type: 'image/png', data: PNG }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toMatch(/^[a-z0-9]{8,16}$/);
    expect(resolveUser).toHaveBeenCalledWith(KEY);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO images/);
    expect(params[0]).toBe(res.body.id);
    expect(params[1]).toBe(USER);
    expect(params[2]).toBe('image/png');
    expect(Buffer.isBuffer(params[3])).toBe(true);
    expect(params[3].toString()).toBe('not really a png');
    expect(params[4]).toBe(16);
    expect(params[5]).toBe(50 * 1024 * 1024);
  });

  test('answers 413 quota exceeded when the quota guard inserts nothing', async () => {
    db.query.mockResolvedValue({ rowCount: 0, rows: [] });
    const res = mockRes();
    await handler(post({ type: 'image/png', data: PNG }), res);
    expect(res.statusCode).toBe(413);
    expect(res.body).toEqual({ error: 'quota exceeded' });
  });

  test('retries once with a new id on a primary-key collision', async () => {
    db.query
      .mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }))
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'ignored' }] });
    const res = mockRes();
    await handler(post({ type: 'image/png', data: PNG }), res);
    expect(res.statusCode).toBe(200);
    expect(db.query).toHaveBeenCalledTimes(2);
    const firstId = db.query.mock.calls[0][1][0];
    const secondId = db.query.mock.calls[1][1][0];
    expect(firstId).not.toBe(secondId);
    expect(res.body.id).toBe(secondId);
  });

  test('returns 502 when the database fails', async () => {
    db.query.mockRejectedValue(Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }));
    const res = mockRes();
    await handler(post({ type: 'image/png', data: PNG }), res);
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'database unavailable' });
  });
});

describe('api/img GET', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    db.isConfigured.mockReturnValue(true);
  });

  test('503 when the database is not configured', async () => {
    db.isConfigured.mockReturnValue(false);
    const res = mockRes();
    await handler(get('abcdef123456'), res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'image store not configured' });
  });

  test('400 for a malformed id', async () => {
    const res = mockRes();
    await handler(get('NO!'), res);
    expect(res.statusCode).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('404 for an unknown id', async () => {
    db.query.mockResolvedValue({ rowCount: 0, rows: [] });
    const res = mockRes();
    await handler(get('abcdef123456'), res);
    expect(res.statusCode).toBe(404);
  });

  test('serves the stored bytes publicly with immutable, nosniff headers', async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    db.query.mockResolvedValue({ rowCount: 1, rows: [{ mime: 'image/png', bytes }] });
    const res = mockRes();
    await handler(get('abcdef123456'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(bytes);
    expect(res.headers['Content-Type']).toBe('image/png');
    expect(res.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(resolveUser).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledWith('SELECT mime, bytes FROM images WHERE id = $1', ['abcdef123456']);
  });

  test('unsupported method returns 405', async () => {
    const res = mockRes();
    await handler({ method: 'DELETE', headers: {}, query: {} }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET, POST');
  });
});
