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

// Issue: clicking a note reordered the sidebar. `bbn.recent` is stored
// most-recently-saved-first, and merely OPENING a note re-saves it (syncNow ->
// saveSnapshot, which unshifts it to the front), so browsing shuffled the tree under
// the reader. Folder rows already sorted by name; notes now do too, so the tree's
// order is a property of its content rather than of what you last looked at.
test('notes sort by title, independent of the order bbn.recent stores them in', () => {
  const recent = [
    { nid: 'c', title: 'gamma',    folder: 'work', t: 9 },
    { nid: 'b', title: 'beta',     folder: null,   t: 8 },
    { nid: 'a', title: 'alpha',    folder: 'work', t: 7 },
    { nid: 'z', title: 'aardvark', folder: null,   t: 6 },
  ];
  const order = (list) => mod.buildTreeRows(list, new Set()).map(r => r.name || r.title);

  expect(order(recent)).toEqual(['work', 'alpha', 'gamma', 'aardvark', 'beta']);

  // Opening 'alpha' bumps it to the front of the store. The tree must not move.
  const afterOpeningAlpha = [recent[2], recent[0], recent[1], recent[3]];
  expect(order(afterOpeningAlpha)).toEqual(order(recent));
});

test('an untitled note sorts under its "untitled" fallback, not first', () => {
  const rows = mod.buildTreeRows([
    { nid: 'u', folder: null, t: 2 },
    { nid: 'b', title: 'beta', folder: null, t: 1 },
  ], new Set());
  expect(rows.map(r => r.title)).toEqual(['beta', 'untitled']);
});

// Legacy and synced snapshots carry unstripped titles like the highlight markup below;
// fileLabel strips that at render time, so the sort key has to strip it too — otherwise
// a note sorts by characters the reader cannot see.
test('notes sort by the label the row shows, not by raw markup in the title', () => {
  const rows = mod.buildTreeRows([
    { nid: 'z', title: '==red:zebra==', folder: null, t: 3 },
    { nid: 'm', title: 'mango',         folder: null, t: 2 },
    { nid: 'a', title: '## apple',      folder: null, t: 1 },
  ], new Set());
  expect(rows.map(r => mod.fileLabel(r.title, null))).toEqual(['apple.md', 'mango.md', 'zebra.md']);
});
