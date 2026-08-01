// Stubs for globals app.js touches at require time (same as the other suites).
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');

// caretScrollDelta(caretTop, caretBottom, viewTop, viewBottom, margin) → px to scroll
// #document-container so the caret sits inside the viewport with a bottom/top margin.
// Positive = scroll down (caret was below the fold), negative = scroll up, 0 = already fine.
// This is the seam behind scrollCaretIntoView, which fixes the caret drifting off-screen
// when Enter grows a block at the bottom (issue #26).

const M = 24; // one-line margin, like the real call

test('a comfortably visible caret needs no scroll', () => {
  expect(mod.caretScrollDelta(400, 420, 0, 784, M)).toBe(0);
});

test('a caret below the fold scrolls down by its overflow plus the margin', () => {
  // caret bottom 790, view bottom 784 → 790 + 24 - 784 = 30
  expect(mod.caretScrollDelta(770, 790, 0, 784, M)).toBe(30);
});

test('a caret above the top scrolls up (negative) to reveal it with margin', () => {
  // caret top 5, view top 0 → 5 - 24 - 0 = -19
  expect(mod.caretScrollDelta(5, 25, 0, 784, M)).toBe(-19);
});

test('a caret exactly one margin above the fold is still considered visible', () => {
  // caret bottom 760, margin 24 → 760 + 24 = 784 == viewBottom → not past it → 0
  expect(mod.caretScrollDelta(742, 760, 0, 784, M)).toBe(0);
});

test('a caret exactly one margin below the top is still considered visible', () => {
  // caret top 24, margin 24 → 24 - 24 = 0 == viewTop → not above it → 0 (symmetric to above)
  expect(mod.caretScrollDelta(24, 44, 0, 784, M)).toBe(0);
});
