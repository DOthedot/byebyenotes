// imageUploadMessage — what a failed (or impossible) paste tells the user. The upload
// itself needs a browser and a server, so only the choice of message is unit-tested.
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const { imageUploadMessage } = require('../app.js');

describe('imageUploadMessage', () => {
  test('signed out: points at /sync instead of attempting an upload', () => {
    expect(imageUploadMessage(0, null, false)).toBe('turn on /sync to paste images');
  });

  test('a bad or rejected sync key names the key', () => {
    expect(imageUploadMessage(400, 'bad key', true)).toBe('sync key rejected — image not uploaded');
    expect(imageUploadMessage(403, 'key rejected', true)).toBe('sync key rejected — image not uploaded');
  });

  test('too large and quota exceeded share 413 but not a message', () => {
    expect(imageUploadMessage(413, 'too large', true)).toBe('image too large');
    expect(imageUploadMessage(413, 'quota exceeded', true)).toBe('image storage full (50 MB)');
  });

  test('a 400 bad image is a generic failure, not a key problem', () => {
    expect(imageUploadMessage(400, 'bad image', true)).toBe('image upload failed');
  });

  test("a 413 from server.js's body limit still reads as too large", () => {
    expect(imageUploadMessage(413, 'payload too large', true)).toBe('image too large');
  });

  test('everything else — 5xx, missing config, network failure — is a generic failure', () => {
    expect(imageUploadMessage(502, 'database unavailable', true)).toBe('image upload failed');
    expect(imageUploadMessage(503, 'sync not configured — no DATABASE_URL', true)).toBe('image upload failed');
    expect(imageUploadMessage(0, null, true)).toBe('image upload failed');
  });
});
