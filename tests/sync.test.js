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

// ── A push must never carry more than the server will accept ─────────────────
// api/notes-store.js slices anything past MAX_NOTES_PER_REQUEST off the end and
// reports nothing, so a batch larger than that loses notes silently on the way out.
// Asserted against the server's own constant rather than a copied literal.
describe('PUSH_BATCH', () => {
  const mod = require('../app.js');
  const store = require('../api/notes-store.js');

  test('never exceeds what one request can carry', () => {
    expect(mod.PUSH_BATCH).toBeLessThanOrEqual(store.MAX_NOTES_PER_REQUEST);
  });

  test('chunk splits exactly at the batch size', () => {
    const list = Array.from({ length: 450 }, (_, i) => i);
    const parts = mod.chunk(list, mod.PUSH_BATCH);
    expect(parts.map(p => p.length)).toEqual([200, 200, 50]);
    expect(parts.flat()).toEqual(list);           // nothing dropped, order kept
  });

  test('a list at or under the limit is one batch, not a copy per item', () => {
    expect(mod.chunk([1, 2, 3], 200)).toEqual([[1, 2, 3]]);
    expect(mod.chunk(Array.from({ length: 200 }, (_, i) => i), 200)).toHaveLength(1);
  });

  test('an empty list still yields one batch, so deletions and prefs still send', () => {
    // A push with no notes is not a no-op: it may carry tombstones or a prefs change.
    expect(mod.chunk([], 200)).toEqual([[]]);
  });

  test('every chunk is within the server limit for a large vault', () => {
    const list = Array.from({ length: 5000 }, (_, i) => i);
    for (const part of mod.chunk(list, mod.PUSH_BATCH)) {
      expect(part.length).toBeLessThanOrEqual(store.MAX_NOTES_PER_REQUEST);
      expect(part.length).toBeGreaterThan(0);
    }
  });
});

// ── The push fingerprint ─────────────────────────────────────────────────────
// Dirtiness is derived by comparing a note's current fingerprint against the one the
// server last accepted, rather than kept as a flag. The fingerprint must therefore
// cover EVERY field that travels — a field it misses is a change that stops syncing.
describe('noteFingerprint', () => {
  const mod = require('../app.js');
  const wire = (over = {}) => ({
    nid: 'n1', blocks: [{ type: 'text', lang: null, content: 'hello' }],
    title: 'a note', titlePinned: true, folder: 'work', theme: null, font: null, ...over,
  });

  test('identical notes fingerprint the same', () => {
    expect(mod.noteFingerprint(wire())).toBe(mod.noteFingerprint(wire()));
  });

  test('a content edit changes it', () => {
    expect(mod.noteFingerprint(wire({ blocks: [{ type: 'text', lang: null, content: 'bye' }] })))
      .not.toBe(mod.noteFingerprint(wire()));
  });

  test('a RENAME changes it — the case a content hash would miss', () => {
    // title/folder/titlePinned live on the snapshot, not inside snap.hash, so
    // fingerprinting the hash alone would make renames and moves stop syncing.
    expect(mod.noteFingerprint(wire({ title: 'renamed' }))).not.toBe(mod.noteFingerprint(wire()));
  });

  test('a MOVE between folders changes it', () => {
    expect(mod.noteFingerprint(wire({ folder: 'personal' }))).not.toBe(mod.noteFingerprint(wire()));
    expect(mod.noteFingerprint(wire({ folder: null }))).not.toBe(mod.noteFingerprint(wire()));
  });

  test('pinning the title changes it', () => {
    expect(mod.noteFingerprint(wire({ titlePinned: false }))).not.toBe(mod.noteFingerprint(wire()));
  });

  test('theme and font changes are covered', () => {
    expect(mod.noteFingerprint(wire({ theme: 'nord' }))).not.toBe(mod.noteFingerprint(wire()));
    expect(mod.noteFingerprint(wire({ font: 'fira-code' }))).not.toBe(mod.noteFingerprint(wire()));
  });

  test('two different notes do not collide on a short string', () => {
    expect(mod.noteFingerprint(wire({ nid: 'n1' }))).not.toBe(mod.noteFingerprint(wire({ nid: 'n2' })));
  });

  test('a missing note fingerprints to empty rather than throwing', () => {
    expect(mod.noteFingerprint(null)).toBe('');
  });

  test('block ORDER matters — reordering is a real change', () => {
    const a = wire({ blocks: [{ type: 'text', content: 'one' }, { type: 'text', content: 'two' }] });
    const b = wire({ blocks: [{ type: 'text', content: 'two' }, { type: 'text', content: 'one' }] });
    expect(mod.noteFingerprint(a)).not.toBe(mod.noteFingerprint(b));
  });
});
