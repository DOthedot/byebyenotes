// Pure client helpers behind tiny-URL sharing (the DOM/async flow is browser-verified).
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (t) => ({ value: t }) };

const mod = require('../app.js');

test('parseTinyId extracts the id from a /s/<id> path', () => {
  expect(mod.parseTinyId('/s/abc123')).toBe('abc123');
  expect(mod.parseTinyId('/s/abc123/')).toBe('abc123');
});

test('parseTinyId returns null for non-tiny or invalid paths', () => {
  expect(mod.parseTinyId('/')).toBeNull();
  expect(mod.parseTinyId('/index.html')).toBeNull();
  expect(mod.parseTinyId('/s/no')).toBeNull();      // too short
  expect(mod.parseTinyId('/s/AB$def')).toBeNull();  // bad chars
  expect(mod.parseTinyId('/s/abc123/extra')).toBeNull();
});

test('TINY_EXPIRY lists 24hr first and covers the four options', () => {
  expect(mod.TINY_EXPIRY[0].ttl).toBe(86400);
  expect(mod.TINY_EXPIRY.map(o => o.ttl).sort((a, b) => a - b)).toEqual([60, 1800, 21600, 86400]);
});

test('tinyExpiryLabel maps ttl to its label and falls back to 24hr', () => {
  expect(mod.tinyExpiryLabel(1800)).toBe('30min');
  expect(mod.tinyExpiryLabel(86400)).toBe('24hr');
  expect(mod.tinyExpiryLabel(999)).toBe('24hr');
});
