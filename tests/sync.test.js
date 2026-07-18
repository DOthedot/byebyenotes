global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch(e) { return null; } }
};

const { mergeRecents } = require('../app.js');

const snap = (nid, t, title = nid) => ({ nid, t, title, blockCount: 1, langs: [] });

test('mergeRecents keeps newest entry per note id', () => {
  const local  = [snap('a', 100), snap('b', 50)];
  const remote = [snap('a', 200, 'a-newer'), snap('c', 75)];
  const merged = mergeRecents(local, remote);
  expect(merged.map(s => s.nid)).toEqual(['a', 'c', 'b']);
  expect(merged[0].title).toBe('a-newer');
});

test('mergeRecents sorts newest-first and caps at 8', () => {
  const many = Array.from({ length: 12 }, (_, i) => snap(`n${i}`, i));
  const merged = mergeRecents(many, []);
  expect(merged).toHaveLength(8);
  expect(merged[0].nid).toBe('n11');
});

test('mergeRecents tolerates null/invalid input', () => {
  expect(mergeRecents(null, undefined)).toEqual([]);
  expect(mergeRecents([null, {}, snap('a', 1)], null).map(s => s.nid)).toEqual(['a']);
});
