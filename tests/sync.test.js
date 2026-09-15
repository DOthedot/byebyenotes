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
  const N = 2000;                       // comfortably above any plausible cap
  const many = Array.from({ length: N }, (_, i) => snap(`n${i}`, i));
  const merged = mergeRecents(many, []);
  expect(merged.length).toBeLessThan(N);
  expect(merged[0].nid).toBe(`n${N - 1}`);
  // Capping must drop the OLDEST, never an arbitrary slice.
  const kept = merged.map(s => s.t);
  expect(kept).toEqual([...kept].sort((a, b) => b - a));
  expect(Math.min(...kept)).toBe(N - merged.length);
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

// ── The store may outgrow one request; every batch leaving it may not ────────
// This used to say the store's ceiling was tied to the server's, because a push sent
// every snapshot in one request and api/notes-store.js sliced the rest away silently.
// Batching broke that tie deliberately. What has to hold now is narrower and is what
// actually protects the data: the store can hold more than one request carries, but
// nothing larger than one request ever leaves it.
describe('the note store and the wire', () => {
  const store = require('../api/notes-store.js');
  const mod = require('../app.js');

  const many = (n) => Array.from({ length: n }, (_, i) => ({
    nid: 'n' + i, title: 't' + i, t: i,
    hash: btoa(JSON.stringify({ blocks: [{ type: 'text', content: 'x' }] })),
  }));

  // This deliberately no longer asserts SNAP_MAX <= MAX_NOTES_PER_REQUEST. That held
  // only while a push sent every note in ONE request, and it is exactly the limit
  // batching removed — the store may now hold more than a single request can carry,
  // because no single request has to carry it.
  test('the store holds more than one request can carry', () => {
    expect(mergeRecents(many(2000), []).length).toBeGreaterThan(store.MAX_NOTES_PER_REQUEST);
  });

  // What must hold instead: however full the store gets, every batch leaving it fits
  // inside one request. This is the assertion that keeps notes from being sliced away
  // server-side, and it is the reason the cap above is allowed to be larger.
  test('a full store still splits into batches the server accepts whole', () => {
    const full = mergeRecents(many(5000), []);
    const batches = mod.chunk(full, mod.PUSH_BATCH);
    expect(batches.length).toBeGreaterThan(1);
    for (const b of batches) {
      expect(b.length).toBeGreaterThan(0);
      expect(b.length).toBeLessThanOrEqual(store.MAX_NOTES_PER_REQUEST);
    }
    expect(batches.reduce((n, b) => n + b.length, 0)).toBe(full.length);
  });

  test('holds enough for a real vault, not a handful', () => {
    expect(mergeRecents(many(5000), []).length).toBeGreaterThanOrEqual(1000);
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

// ── Telling a quota error from an unusable store ─────────────────────────────
// Only the first is fixable by trimming. Treating a disabled-storage error as a size
// problem would retry a write that can never succeed; treating a quota error as fatal
// would throw away a list that would have fit at half the size.
describe('isQuotaError', () => {
  const mod = require('../app.js');
  const err = (over) => Object.assign(new Error('x'), over);

  test('recognises the standard quota error', () => {
    expect(mod.isQuotaError(err({ name: 'QuotaExceededError' }))).toBe(true);
  });

  test('recognises the Firefox spelling and the legacy codes', () => {
    expect(mod.isQuotaError(err({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }))).toBe(true);
    expect(mod.isQuotaError(err({ code: 22 }))).toBe(true);
    expect(mod.isQuotaError(err({ code: 1014 }))).toBe(true);
  });

  test('does NOT treat a disabled store as a size problem', () => {
    // Safari private browsing throws SecurityError; retrying smaller never helps.
    expect(mod.isQuotaError(err({ name: 'SecurityError' }))).toBe(false);
    expect(mod.isQuotaError(err({ name: 'TypeError' }))).toBe(false);
  });

  test('survives junk without throwing', () => {
    for (const bad of [null, undefined, 0, '', {}, 'QuotaExceededError']) {
      expect(mod.isQuotaError(bad)).toBe(false);
    }
  });
});
