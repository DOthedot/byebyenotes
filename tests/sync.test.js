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

test('mergeRecents sorts newest-first and caps the list', () => {
  // Deliberately not asserting a literal cap. This test hardcoded 30 and had to be
  // edited when the ceiling moved; what actually matters is that the list IS capped
  // and that the survivors are the newest, whatever the number happens to be.
  const many = Array.from({ length: 400 }, (_, i) => snap(`n${i}`, i));
  const merged = mergeRecents(many, []);
  expect(merged.length).toBeLessThan(400);
  expect(merged[0].nid).toBe('n399');
  // Capping must drop the OLDEST, never an arbitrary slice.
  const kept = merged.map(s => s.t);
  expect(kept).toEqual([...kept].sort((a, b) => b - a));
  expect(Math.min(...kept)).toBe(400 - merged.length);
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

// ── The note store's ceiling is tied to the server's, not chosen freely ───────
// pushNow sends every snapshot in one request and api/notes-store.js slices anything
// past MAX_NOTES_PER_REQUEST away without reporting it. A local cap above that number
// would swap a visible local limit for silent loss on the server, so the two must not
// drift apart.
describe('SNAP_MAX', () => {
  const store = require('../api/notes-store.js');

  test('never exceeds what one sync request can carry', () => {
    const many = Array.from({ length: 400 }, (_, i) => ({
      nid: 'n' + i, title: 't' + i, t: i,
      hash: btoa(JSON.stringify({ blocks: [{ type: 'text', content: 'x' }] })),
    }));
    const kept = mergeRecents(many, []).length;
    expect(kept).toBeLessThanOrEqual(store.MAX_NOTES_PER_REQUEST);
  });

  test('holds more than a trivial handful, so a real vault fits', () => {
    const many = Array.from({ length: 400 }, (_, i) => ({
      nid: 'n' + i, title: 't' + i, t: i,
      hash: btoa(JSON.stringify({ blocks: [{ type: 'text', content: 'x' }] })),
    }));
    expect(mergeRecents(many, []).length).toBeGreaterThanOrEqual(200);
  });
});
