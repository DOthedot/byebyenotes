// Stubs for globals app.js touches at require time (same as the other suites).
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');

const sampleSnap = () => ({
  nid: 'n1', t: Date.now(), title: 'my note', folder: null,
  blockCount: 1, langs: [], hash: '#abc',
});

const folderBtn = (snap) => mod.makeRecentRow(snap).querySelector('.ri-folder');

test('recent row renders a move-to-folder button', () => {
  expect(folderBtn(sampleSnap())).not.toBeNull();
});

test('folder button uses a vector icon, not the old ▦ glyph', () => {
  const btn = folderBtn(sampleSnap());
  expect(btn.querySelector('svg')).not.toBeNull();
  expect(btn.textContent).not.toContain('▦');
});

test('folder button has an accessible label instead of a native title', () => {
  const btn = folderBtn(sampleSnap());
  expect(btn.getAttribute('aria-label')).toBe('move to folder');
  expect(btn.hasAttribute('title')).toBe(false);
});

test('folder button exposes its label to the styled tooltip via data-tip', () => {
  expect(folderBtn(sampleSnap()).getAttribute('data-tip')).toBe('move to folder');
});

// ── isOpenableSnapshot (issue #19: recents with a dead hash open a blank note) ──
// A snapshot only opens to real content when its hash decodes to a state with blocks.
// The test LZString stub is base64, so a valid hash is btoa(JSON.stringify(state)).
const openableHash = (state) => btoa(JSON.stringify(state));

test('isOpenableSnapshot: true when the hash decodes to a state with blocks', () => {
  const s = { nid: 'n', hash: openableHash({ blocks: [{ type: 'text', content: 'hi' }] }) };
  expect(mod.isOpenableSnapshot(s)).toBe(true);
});

test('isOpenableSnapshot: false for an empty-string hash (the reported "no # at all" case)', () => {
  expect(mod.isOpenableSnapshot({ nid: 'n', hash: '' })).toBe(false);
});

test('isOpenableSnapshot: false when the hash field is missing (opens "#undefined")', () => {
  expect(mod.isOpenableSnapshot({ nid: 'n' })).toBe(false);
});

test('isOpenableSnapshot: false when the hash does not decode', () => {
  expect(mod.isOpenableSnapshot({ nid: 'n', hash: '@@not-base64@@' })).toBe(false);
});

test('isOpenableSnapshot: false when the decoded state has no blocks', () => {
  expect(mod.isOpenableSnapshot({ nid: 'n', hash: openableHash({ blocks: [] }) })).toBe(false);
});

test('isOpenableSnapshot: false for a null/undefined snapshot', () => {
  expect(mod.isOpenableSnapshot(null)).toBe(false);
  expect(mod.isOpenableSnapshot(undefined)).toBe(false);
});
