// Stubs for globals app.js touches at require time (same as the other suites).
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');

const snaps = [
  { nid: 'a', title: 'alpha',  folder: 'work',     t: 3 },
  { nid: 'b', title: 'beta',   folder: null,       t: 2 },
  { nid: 'c', title: 'gamma',  folder: 'work',     t: 1 },
  { nid: 'd', title: 'delta',  folder: 'personal', t: 4 },
];

test('folders come first, sorted, each followed by its notes; loose notes last', () => {
  const rows = mod.buildTreeRows(snaps, new Set());
  expect(rows.map(r => [r.kind, r.name || r.title])).toEqual([
    ['folder', 'personal'],
    ['note',   'delta'],
    ['folder', 'work'],
    ['note',   'alpha'],
    ['note',   'gamma'],
    ['note',   'beta'],
  ]);
});

test('a folded folder still renders its header but hides its notes', () => {
  const rows = mod.buildTreeRows(snaps, new Set(['work']));
  expect(rows.filter(r => r.kind === 'note').map(r => r.title)).toEqual(['delta', 'beta']);
  const work = rows.find(r => r.kind === 'folder' && r.name === 'work');
  expect(work).toMatchObject({ folded: true, count: 2 });
});

test('folder rows carry the count of their notes even when folded', () => {
  const rows = mod.buildTreeRows(snaps, new Set());
  expect(rows.find(r => r.name === 'personal').count).toBe(1);
});

test('a snapshot with no title falls back to "untitled"', () => {
  const rows = mod.buildTreeRows([{ nid: 'x', folder: null, t: 1 }], new Set());
  expect(rows[0].title).toBe('untitled');
});

test('empty and non-array input produce no rows', () => {
  expect(mod.buildTreeRows([], new Set())).toEqual([]);
  expect(mod.buildTreeRows(null, new Set())).toEqual([]);
});

test('a missing folded set is treated as nothing folded', () => {
  const rows = mod.buildTreeRows(snaps);
  expect(rows.filter(r => r.kind === 'note')).toHaveLength(4);
});
