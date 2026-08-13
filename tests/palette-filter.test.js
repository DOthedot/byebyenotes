// Stubs for globals app.js touches at require time (same as the other suites).
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');

const ITEMS = [
  { id: 'sb-toggle',       label: 'hide sidebar',       desc: 'toggle the notes panel' },
  { id: 'sb-opacity-down', label: 'dimmer background',  desc: 'opacity 45%' },
  { id: 'sb-wall:grid',    label: 'Grid',               desc: 'background', hint: 'on' },
];

test('an empty query returns the list untouched', () => {
  expect(mod.filterPaletteItems(ITEMS, '')).toBe(ITEMS);
  expect(mod.filterPaletteItems(ITEMS, undefined)).toBe(ITEMS);
});

test('matches on label, desc and hint, case-insensitively', () => {
  expect(mod.filterPaletteItems(ITEMS, 'DIMMER').map(i => i.id)).toEqual(['sb-opacity-down']);
  expect(mod.filterPaletteItems(ITEMS, 'panel').map(i => i.id)).toEqual(['sb-toggle']);
  expect(mod.filterPaletteItems(ITEMS, 'on').map(i => i.id)).toEqual(['sb-wall:grid']);
});

test('a leading slash is ignored so /focus matches the focus row', () => {
  expect(mod.filterPaletteItems(ITEMS, '/dimmer').map(i => i.id)).toEqual(['sb-opacity-down']);
});

test('no match yields an empty list, not the whole list', () => {
  expect(mod.filterPaletteItems(ITEMS, 'zzz')).toEqual([]);
});

test('rows missing label/desc/hint do not throw', () => {
  expect(mod.filterPaletteItems([{ heading: 'SHORTCUTS' }, ITEMS[0]], 'hide').map(i => i.id))
    .toEqual(['sb-toggle']);
});
