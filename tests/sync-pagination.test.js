const { encodeCursor, decodeCursor } = require('../api/notes-store.js');

// The cursor is echoed back by the client and interpolated near a SQL predicate, so
// it is untrusted input that happens to look like our own data. Everything here is
// about it failing closed.
describe('pull cursor', () => {
  test('round-trips a row', () => {
    const c = encodeCursor({ updated_at_ms: 1758000000000, client_nid: 'k8lpavwl' });
    expect(decodeCursor(c)).toEqual({ ms: 1758000000000, nid: 'k8lpavwl' });
  });

  test('a nid containing a colon still round-trips', () => {
    // The encoding splits on the FIRST colon, so a nid may not contain one — but if a
    // future nid format did, this must not silently truncate it into a different nid.
    const c = encodeCursor({ updated_at_ms: 1, client_nid: 'a:b' });
    expect(decodeCursor(c)).toBeNull();   // rejected by the nid shape check, not mangled
  });

  test('garbage is treated as absent, not as an error', () => {
    for (const bad of [null, undefined, '', 'not-base64!!', 'x'.repeat(300), 42, {}]) {
      expect(decodeCursor(bad)).toBeNull();
    }
  });

  test('a cursor cannot smuggle SQL through the nid', () => {
    const evil = Buffer.from("1:' OR 1=1 --", 'utf8').toString('base64url');
    expect(decodeCursor(evil)).toBeNull();
  });

  test('a cursor cannot smuggle SQL through the timestamp', () => {
    const evil = Buffer.from('1 OR 1=1:abc', 'utf8').toString('base64url');
    expect(decodeCursor(evil)).toBeNull();
  });

  test('a non-positive or non-finite timestamp is rejected', () => {
    for (const ms of ['0', '-1', 'NaN', 'Infinity', '1e999']) {
      expect(decodeCursor(Buffer.from(ms + ':abc', 'utf8').toString('base64url'))).toBeNull();
    }
  });

  test('an over-long nid is rejected rather than truncated', () => {
    const long = Buffer.from('1:' + 'a'.repeat(65), 'utf8').toString('base64url');
    expect(decodeCursor(long)).toBeNull();
  });

  test('a nid at exactly the allowed length is accepted', () => {
    const ok = Buffer.from('1:' + 'a'.repeat(64), 'utf8').toString('base64url');
    expect(decodeCursor(ok)).toEqual({ ms: 1, nid: 'a'.repeat(64) });
  });

  test('a missing separator is rejected', () => {
    expect(decodeCursor(Buffer.from('1758000000000', 'utf8').toString('base64url'))).toBeNull();
  });

  test('an empty timestamp half is rejected', () => {
    expect(decodeCursor(Buffer.from(':abc', 'utf8').toString('base64url'))).toBeNull();
  });
});
