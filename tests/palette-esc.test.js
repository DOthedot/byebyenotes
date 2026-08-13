// Stubs for globals app.js touches at require time (same as the other suites).
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');

test('help ESC targets the command menu', () => {
  expect(mod.paletteEscTarget('help', false)).toBe('command');
});

test('command/insert/format ESC closes the palette', () => {
  expect(mod.paletteEscTarget('command', false)).toBe('close');
  expect(mod.paletteEscTarget('insert', false)).toBe('close');
  expect(mod.paletteEscTarget('format', false)).toBe('close');
});

test('anchored lang ESC returns to the insert menu', () => {
  expect(mod.paletteEscTarget('lang', true)).toBe('insert');
});

test('unanchored lang / other modes ESC returns to the command menu', () => {
  expect(mod.paletteEscTarget('lang', false)).toBe('command');
  expect(mod.paletteEscTarget('theme', false)).toBe('command');
});

test('settings backs out to the command menu, like help', () => {
  expect(mod.paletteEscTarget('settings', false)).toBe('command');
});
