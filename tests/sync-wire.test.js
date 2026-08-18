/**
 * snapshotToWireNote / wireNoteToSnapshot — the whole client↔server translation.
 *
 * The server stores `blocks` and has no LZString, so the URL hash is re-derived on
 * this side. That makes these two functions the single point where a note can be
 * silently mangled on its way to another device, which is why the round trip is
 * asserted on identity rather than on individual fields.
 */
global.LZString = {
  compressToEncodedURIComponent: (s) => Buffer.from(s, 'utf8').toString('base64'),
  decompressFromEncodedURIComponent: (s) => {
    try { return Buffer.from(s, 'base64').toString('utf8'); } catch (e) { return null; }
  },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');
const { snapshotToWireNote, wireNoteToSnapshot, encodeState, decodeState } = mod;

const blocks = [
  { type: 'text', content: '# Design notes', lang: null },
  { type: 'code', content: 'const x = 1;',   lang: 'js'  },
];

const snap = (over = {}) => ({
  nid: 'abc123',
  hash: encodeState({ nid: 'abc123', blocks, theme: 'mocha', font: 'jetbrains' }),
  title: 'Design notes',
  renamed: false,
  folder: 'work/2026',
  blockCount: 2,
  langs: ['js'],
  t: 1700000000000,
  ...over,
});

describe('snapshotToWireNote', () => {
  test('unpacks the hash into the blocks the server actually stores', () => {
    expect(snapshotToWireNote(snap()).blocks).toEqual(blocks);
  });

  test('carries the fields that have their own columns', () => {
    const w = snapshotToWireNote(snap({ renamed: true }));
    expect(w).toMatchObject({
      nid: 'abc123', title: 'Design notes', titlePinned: true,
      folder: 'work/2026', theme: 'mocha', font: 'jetbrains',
    });
  });

  test('does not send the hash — that is the copy that can go stale', () => {
    expect(snapshotToWireNote(snap())).not.toHaveProperty('hash');
  });

  test('a snapshot whose hash will not decode is dropped, not sent as an empty note', () => {
    // Pushing this as `blocks: []` would overwrite a perfectly good server-side
    // note with nothing — issue #19's failure mode, one layer down.
    expect(snapshotToWireNote(snap({ hash: 'not-valid-base64!!' }))).toBeNull();
    expect(snapshotToWireNote(snap({ hash: '' }))).toBeNull();
    expect(snapshotToWireNote({ nid: 'x' })).toBeNull();
    expect(snapshotToWireNote(null)).toBeNull();
  });

  test('top level is null rather than an empty string', () => {
    expect(snapshotToWireNote(snap({ folder: '' })).folder).toBeNull();
    expect(snapshotToWireNote(snap({ folder: undefined })).folder).toBeNull();
  });
});

describe('wireNoteToSnapshot', () => {
  const wire = {
    nid: 'abc123', blocks, title: 'Design notes', titlePinned: true,
    folder: 'work/2026', theme: 'mocha', font: 'jetbrains', t: 1700000000000,
  };

  test('rebuilds a hash that decodes back to the same state', () => {
    expect(decodeState(wireNoteToSnapshot(wire).hash))
      .toEqual({ nid: 'abc123', blocks, theme: 'mocha', font: 'jetbrains' });
  });

  test('titlePinned becomes renamed — the name app.js uses everywhere else', () => {
    expect(wireNoteToSnapshot(wire).renamed).toBe(true);
    expect(wireNoteToSnapshot({ ...wire, titlePinned: false }).renamed).toBe(false);
  });

  test('re-derives blockCount and langs instead of trusting the server for them', () => {
    const s = wireNoteToSnapshot(wire);
    expect(s.blockCount).toBe(2);
    expect(s.langs).toEqual(['js']);
  });

  test('a malformed row is dropped rather than becoming a blank snapshot', () => {
    expect(wireNoteToSnapshot({ nid: 'x', blocks: 'nope' })).toBeNull();
    expect(wireNoteToSnapshot({ blocks: [] })).toBeNull();
    expect(wireNoteToSnapshot(null)).toBeNull();
  });

  test('a missing t falls back to now, so mergeRecents never sorts on NaN', () => {
    expect(typeof wireNoteToSnapshot({ ...wire, t: undefined }).t).toBe('number');
    expect(Number.isNaN(wireNoteToSnapshot({ ...wire, t: 'garbage' }).t)).toBe(false);
  });
});

describe('round trip', () => {
  test('snapshot -> wire -> snapshot is lossless for everything that is stored', () => {
    const before = snap({ renamed: true });
    const after  = wireNoteToSnapshot({ ...snapshotToWireNote(before), t: before.t });
    expect(after).toEqual(before);
  });

  test('an empty note survives the trip without collapsing to null', () => {
    const empty = { nid: 'e1', hash: encodeState({ nid: 'e1', blocks: [{ type: 'text', content: '', lang: null }] }), title: 'untitled', t: 1 };
    const after = wireNoteToSnapshot({ ...snapshotToWireNote(empty), t: 1 });
    expect(after.nid).toBe('e1');
    expect(after.blockCount).toBe(1);
  });

  test('the merge key survives — mergeRecents still dedupes across the trip', () => {
    const local  = snap({ t: 2000, title: 'newer local' });
    const remote = wireNoteToSnapshot({ ...snapshotToWireNote(snap({ title: 'older remote' })), t: 1000 });
    const merged = mod.mergeRecents([local], [remote]);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('newer local');
  });
});
