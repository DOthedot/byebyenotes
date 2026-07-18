global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch(e) { return null; } }
};

const { mergeRecents, groupByFolder } = require('../app.js');

const snap = (nid, t, title = nid, folder = null) => ({ nid, t, title, folder, blockCount: 1, langs: [] });

test('mergeRecents keeps newest entry per note id', () => {
  const local  = [snap('a', 100), snap('b', 50)];
  const remote = [snap('a', 200, 'a-newer'), snap('c', 75)];
  const merged = mergeRecents(local, remote);
  expect(merged.map(s => s.nid)).toEqual(['a', 'c', 'b']);
  expect(merged[0].title).toBe('a-newer');
});

test('mergeRecents sorts newest-first and caps at 30', () => {
  const many = Array.from({ length: 35 }, (_, i) => snap(`n${i}`, i));
  const merged = mergeRecents(many, []);
  expect(merged).toHaveLength(30);
  expect(merged[0].nid).toBe('n34');
});

test('groupByFolder splits loose notes from sorted folders', () => {
  const snaps = [
    snap('a', 3), snap('b', 2, 'b', 'work'), snap('c', 1, 'c', 'ideas'), snap('d', 0, 'd', 'work'),
  ];
  const { loose, folders } = groupByFolder(snaps);
  expect(loose.map(s => s.nid)).toEqual(['a']);
  expect(folders.map(f => f[0])).toEqual(['ideas', 'work']);
  expect(folders[1][1].map(s => s.nid)).toEqual(['b', 'd']);
});

test('groupByFolder treats blank folder as loose', () => {
  const { loose, folders } = groupByFolder([snap('a', 1, 'a', '  '), snap('b', 0)]);
  expect(loose).toHaveLength(2);
  expect(folders).toHaveLength(0);
});

test('mergeRecents tolerates null/invalid input', () => {
  expect(mergeRecents(null, undefined)).toEqual([]);
  expect(mergeRecents([null, {}, snap('a', 1)], null).map(s => s.nid)).toEqual(['a']);
});
