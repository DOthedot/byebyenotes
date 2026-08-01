// Stubs for globals app.js touches at require time (same as the other suites).
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');

// restorableCaret guards closePalette's caret restore: only re-apply a saved
// Range when its start node is still inside the block being refocused. A stale
// range (block re-rendered) or a missing range must fall back to default focus.

function rangeAt(node, offset = 0) {
  const r = document.createRange();
  r.setStart(node, offset);
  r.collapse(true);
  return r;
}

test('caret whose start is inside the block is restorable', () => {
  const content = document.createElement('div');
  content.textContent = 'hello ';
  document.body.appendChild(content);
  const range = rangeAt(content.firstChild, 6); // after the trailing space
  expect(mod.restorableCaret(range, content)).toBe(true);
});

test('caret pointing outside the block is not restorable', () => {
  const content = document.createElement('div');
  content.textContent = 'hello ';
  const other = document.createElement('div');
  other.textContent = 'elsewhere';
  document.body.append(content, other);
  const range = rangeAt(other.firstChild, 0);
  expect(mod.restorableCaret(range, content)).toBe(false);
});

test('a missing range or block is not restorable', () => {
  const content = document.createElement('div');
  content.textContent = 'hi';
  expect(mod.restorableCaret(null, content)).toBe(false);
  expect(mod.restorableCaret(rangeAt(content.firstChild, 0), null)).toBe(false);
});
