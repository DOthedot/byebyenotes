/**
 * @jest-environment node
 *
 * api/redis.js — the Redis connection owner. The `redis` package is mocked with an
 * EventEmitter standing in for the client, so these tests pin the FAIL-FAST contract
 * (bounded wait, no offline queue, one shared client), not the wire protocol.
 */
const { EventEmitter } = require('events');

let mockClient;
jest.mock('redis', () => ({ createClient: jest.fn(() => mockClient) }));

function makeClient({ ready = true } = {}) {
  const c = new EventEmitter();
  c.isReady = ready;
  c.connect = jest.fn(() => Promise.resolve());
  c.get = jest.fn();
  c.set = jest.fn();
  return c;
}

describe('api/redis', () => {
  const OLD = process.env;
  let redis;
  let createClient;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD, REDIS_URL: 'redis://default:pw@redis.railway.internal:6379' };
    mockClient = makeClient();
    redis = require('../api/redis');
    createClient = require('redis').createClient;
  });

  afterEach(() => {
    process.env = OLD;
    jest.useRealTimers();
  });

  test('isConfigured follows REDIS_URL', () => {
    expect(redis.isConfigured()).toBe(true);
    delete process.env.REDIS_URL;
    expect(redis.isConfigured()).toBe(false);
  });

  test('rejects without creating a client when REDIS_URL is unset', async () => {
    delete process.env.REDIS_URL;
    await expect(redis.get('k')).rejects.toThrow('redis not configured');
    expect(createClient).not.toHaveBeenCalled();
  });

  test('creates one fail-fast client and reuses it', async () => {
    mockClient.get.mockResolvedValue('v');
    await redis.get('a');
    await redis.get('b');
    expect(createClient).toHaveBeenCalledTimes(1);
    const opts = createClient.mock.calls[0][0];
    expect(opts.url).toBe('redis://default:pw@redis.railway.internal:6379');
    expect(opts.disableOfflineQueue).toBe(true);
    expect(opts.socket.connectTimeout).toBe(5000);
    expect(opts.socket.reconnectStrategy(0)).toBe(50);
    expect(opts.socket.reconnectStrategy(10)).toBe(2000);
    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(mockClient.listenerCount('error')).toBe(1);
  });

  test('get returns the stored value', async () => {
    mockClient.get.mockResolvedValue('STORED');
    await expect(redis.get('tiny:abc')).resolves.toBe('STORED');
    expect(mockClient.get).toHaveBeenCalledWith('tiny:abc');
  });

  test('setIfAbsent sends EX + NX and maps OK to true', async () => {
    mockClient.set.mockResolvedValue('OK');
    await expect(redis.setIfAbsent('tiny:abc', 'HASH', 60)).resolves.toBe(true);
    expect(mockClient.set).toHaveBeenCalledWith('tiny:abc', 'HASH', { EX: 60, NX: true });
  });

  test('setIfAbsent maps a null reply (key existed) to false', async () => {
    mockClient.set.mockResolvedValue(null);
    await expect(redis.setIfAbsent('tiny:abc', 'HASH', 60)).resolves.toBe(false);
  });

  test('waits for ready, then runs the command', async () => {
    mockClient = makeClient({ ready: false });
    mockClient.get.mockResolvedValue('LATE');
    const pending = redis.get('k');
    mockClient.isReady = true;
    mockClient.emit('ready');
    await expect(pending).resolves.toBe('LATE');
  });

  test('rejects after READY_TIMEOUT_MS when the client never becomes ready', async () => {
    jest.useFakeTimers();
    mockClient = makeClient({ ready: false });
    const assertion = expect(redis.get('k')).rejects.toThrow('redis not ready');
    jest.advanceTimersByTime(redis.READY_TIMEOUT_MS);
    await assertion;
    expect(mockClient.get).not.toHaveBeenCalled();
    expect(mockClient.listenerCount('ready')).toBe(0);
  });
});
