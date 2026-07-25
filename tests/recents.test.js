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
