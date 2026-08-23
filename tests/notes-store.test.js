/**
 * @jest-environment node
 *
 * api/notes-store.js — the untrusted-payload boundary.
 *
 * Every value here arrives from a browser holding a sync key and is handed to
 * ANOTHER of that user's devices to render, so the cases that matter are the ones
 * where a hostile or broken payload has to become something safe (or nothing)
 * rather than a constraint violation that 500s the whole sync.
 */
const store = require('../api/notes-store');

describe('normalizeFolder', () => {
  test('joins and trims segments the way app.js folderSegments does', () => {
    expect(store.normalizeFolder(' work / 2026 ')).toBe('work/2026');
  });

  test('collapses empty segments instead of producing a path the CHECK rejects', () => {
    expect(store.normalizeFolder('//work//2026//')).toBe('work/2026');
  });

  test('top level is null, never an empty string', () => {
    // notes.folder is nullable; '' would fail notes_folder_shape and 500 the request.
    expect(store.normalizeFolder('')).toBeNull();
    expect(store.normalizeFolder(null)).toBeNull();
    expect(store.normalizeFolder(undefined)).toBeNull();
    expect(store.normalizeFolder('   ')).toBeNull();
    expect(store.normalizeFolder('/')).toBeNull();
  });

  test('caps depth at FOLDER_MAX_DEPTH — deeper input blew the stack in renderSidebar', () => {
    const deep = Array.from({ length: 50 }, (_, i) => `d${i}`).join('/');
    expect(store.normalizeFolder(deep).split('/')).toHaveLength(store.FOLDER_MAX_DEPTH);
  });

  test('rejects an over-long path rather than truncating it mid-segment', () => {
    expect(store.normalizeFolder('x'.repeat(600))).toBeNull();
  });

  test('survives non-strings', () => {
    expect(store.normalizeFolder(42)).toBe('42');
    expect(store.normalizeFolder({})).toBeNull();   // "[object Object]" has no slash issue but spaces do
  });
});

describe('sanitizeBlocks', () => {
  test('keeps a well-formed block untouched', () => {
    expect(store.sanitizeBlocks([{ type: 'code', lang: 'js', content: 'x' }]))
      .toEqual([{ type: 'code', lang: 'js', content: 'x' }]);
  });

  test('an unknown block type degrades to text rather than reaching the client', () => {
    expect(store.sanitizeBlocks([{ type: 'iframe', content: 'x' }])[0].type).toBe('text');
  });

  test('lang is constrained to a slug — it becomes a highlight.js class name', () => {
    expect(store.sanitizeBlocks([{ type: 'code', lang: 'js" onload="alert(1)', content: '' }])[0].lang)
      .toBeNull();
    expect(store.sanitizeBlocks([{ type: 'code', lang: 'c++', content: '' }])[0].lang).toBe('c++');
  });

  test('non-string content becomes empty, not "[object Object]"', () => {
    expect(store.sanitizeBlocks([{ type: 'text', content: { a: 1 } }])[0].content).toBe('');
  });

  test('a non-array is null — notes_blocks_is_array would otherwise reject it', () => {
    expect(store.sanitizeBlocks('nope')).toBeNull();
    expect(store.sanitizeBlocks({ 0: 'x' })).toBeNull();
  });

  test('oversize content is null, matching the notes_blocks_size constraint', () => {
    expect(store.sanitizeBlocks([{ type: 'text', content: 'x'.repeat(500000) }])).toBeNull();
  });
});

describe('sanitizeNote', () => {
  const good = { nid: 'abc123', blocks: [{ type: 'text', content: 'hi' }] };

  test('a note without a usable nid is dropped', () => {
    expect(store.sanitizeNote({ ...good, nid: '' })).toBeNull();
    expect(store.sanitizeNote({ ...good, nid: 'has spaces' })).toBeNull();
    expect(store.sanitizeNote({ ...good, nid: 'x'.repeat(100) })).toBeNull();
  });

  test('a missing title falls back to untitled rather than violating NOT NULL', () => {
    expect(store.sanitizeNote(good).title).toBe('untitled');
  });

  test('title is truncated to the same 48 chars app.js allows on rename', () => {
    expect(store.sanitizeNote({ ...good, title: 'y'.repeat(200) }).title).toHaveLength(48);
  });

  test('titlePinned is strictly boolean — a truthy string must not pin a title', () => {
    expect(store.sanitizeNote({ ...good, titlePinned: 'yes' }).titlePinned).toBe(false);
    expect(store.sanitizeNote({ ...good, titlePinned: true }).titlePinned).toBe(true);
  });

  test('theme and font are slugs or null, never arbitrary text', () => {
    const n = store.sanitizeNote({ ...good, theme: 'catppuccin-mocha', font: '../../etc' });
    expect(n.theme).toBe('catppuccin-mocha');
    expect(n.font).toBeNull();
  });
});

describe('sanitizeNotes', () => {
  const note = (nid, content) => ({ nid, blocks: [{ type: 'text', content }] });

  test('one broken note is skipped, the rest still sync', () => {
    const out = store.sanitizeNotes([note('a', '1'), { nid: '!!' }, note('b', '2')]);
    expect(out.map(n => n.nid)).toEqual(['a', 'b']);
  });

  test('a duplicate nid collapses to the last one', () => {
    // Postgres refuses to let one INSERT ... ON CONFLICT touch the same row twice
    // ("cannot affect row a second time"), which would fail the entire push.
    const out = store.sanitizeNotes([note('a', 'first'), note('a', 'second')]);
    expect(out).toHaveLength(1);
    expect(out[0].blocks[0].content).toBe('second');
  });

  test('the batch is capped', () => {
    const many = Array.from({ length: 500 }, (_, i) => note(`n${i}`, 'x'));
    expect(store.sanitizeNotes(many)).toHaveLength(store.MAX_NOTES_PER_REQUEST);
  });

  test('a non-array payload is an empty batch, not a throw', () => {
    expect(store.sanitizeNotes(null)).toEqual([]);
    expect(store.sanitizeNotes('notes')).toEqual([]);
  });
});

describe('sanitizePrefs', () => {
  test('strips the wallpaper — it has its own column and its own budget', () => {
    const out = store.sanitizePrefs({ theme: 'mocha', sidebar: { wall: 'custom', custom: 'data:image/png;base64,AAAA', blur: 2 } });
    expect(out.sidebar).toEqual({ wall: 'custom', blur: 2 });
    expect(out.sidebar.custom).toBeUndefined();
  });

  test('rejects rather than truncates when over the 32KB column budget', () => {
    expect(store.sanitizePrefs({ junk: 'x'.repeat(40000) })).toBeNull();
  });

  test('only a plain object is prefs — user_prefs_is_object would reject the rest', () => {
    expect(store.sanitizePrefs([])).toBeNull();
    expect(store.sanitizePrefs('theme=mocha')).toBeNull();
    expect(store.sanitizePrefs(null)).toBeNull();
  });

  test('a note-shaped prefs bag round-trips intact', () => {
    const prefs = { theme: 'mocha', font: 'jetbrains', t: 1, tabs: ['a', 'b'], folders: ['work'] };
    expect(store.sanitizePrefs(prefs)).toEqual(prefs);
  });
});

describe('sanitizeImage', () => {
  test('accepts a data URI within budget', () => {
    expect(store.sanitizeImage('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA');
  });

  test('rejects anything that is not an inline image', () => {
    // A remote URL here would make every sidebar render a request to a third party.
    expect(store.sanitizeImage('https://example.com/x.png')).toBeNull();
    expect(store.sanitizeImage('data:text/html;base64,AAAA')).toBeNull();
    expect(store.sanitizeImage('javascript:alert(1)')).toBeNull();
  });

  test('empty and null both mean "no image"', () => {
    expect(store.sanitizeImage('')).toBeNull();
    expect(store.sanitizeImage(null)).toBeNull();
  });

  test('rejects over the user_prefs_image_size cap', () => {
    expect(store.sanitizeImage('data:image/png;base64,' + 'A'.repeat(300000))).toBeNull();
  });
});

describe('rowToNote', () => {
  test('maps a row onto the shape mergeRecents already sorts on', () => {
    expect(store.rowToNote({
      client_nid: 'abc', blocks: [], title: 'hi', title_pinned: true,
      folder: 'work', theme: null, font: null,
      updated_at_ms: '1700000000000', deleted_at: null,
    })).toEqual({
      nid: 'abc', blocks: [], title: 'hi', titlePinned: true, folder: 'work',
      theme: null, font: null, t: 1700000000000, deleted: false,
    });
  });

  test('updated_at_ms arrives from pg as a string and must not stay one', () => {
    // bigint comes back as text; a string `t` would compare wrong in mergeRecents.
    const t = store.rowToNote({ client_nid: 'a', blocks: [], title: '', title_pinned: false,
      folder: null, theme: null, font: null, updated_at_ms: '1700000000000', deleted_at: null }).t;
    expect(typeof t).toBe('number');
  });

  test('a tombstoned row is flagged deleted', () => {
    expect(store.rowToNote({ client_nid: 'a', blocks: [], title: '', title_pinned: false,
      folder: null, theme: null, font: null, updated_at_ms: '1', deleted_at: new Date() }).deleted).toBe(true);
  });
});

describe('Unicode well-formedness (Postgres rejects lone surrogates outright)', () => {
  const LONE = String.fromCharCode(0xD800);

  test('a lone surrogate in block content is replaced, not passed through', () => {
    // Passing it through made Postgres throw "invalid input syntax for type json",
    // which aborts the transaction — so one broken character killed the entire push,
    // including every well-formed note batched alongside it.
    const out = store.sanitizeBlocks([{ type: 'text', content: 'a' + LONE + 'b' }]);
    expect(out[0].content).toBe('a�b');
    expect(JSON.stringify(out)).not.toMatch(/\\ud800/i);
  });

  test('real emoji and CJK survive untouched', () => {
    const out = store.sanitizeBlocks([{ type: 'text', content: 'ok 😀 漢字 🇮🇳' }]);
    expect(out[0].content).toBe('ok 😀 漢字 🇮🇳');
  });

  test('a title is cut on a code-point boundary, never mid-emoji', () => {
    // The realistic trigger: slice(0,48) bisecting an emoji straddling the cut, which
    // permanently broke that user's sync until they renamed the note.
    const note = store.sanitizeNote({
      nid: 'e1', blocks: [{ type: 'text', content: 'x' }],
      title: 'x'.repeat(47) + '😀 trailing text',
    });
    expect(note.title.isWellFormed ? note.title.isWellFormed() : true).toBe(true);
    expect(JSON.stringify(note.title)).not.toMatch(/\\ud[89ab][0-9a-f]{2}/i);
  });

  test('a broken folder path is repaired rather than rejected', () => {
    expect(store.normalizeFolder('work' + LONE + '/2026')).toBe('work�/2026');
  });

  test('prefs strings are well-formed too', () => {
    expect(JSON.stringify(store.sanitizePrefs({ t: 1, note: 'a' + LONE }))).not.toMatch(/\\ud800/i);
  });
});

describe('prefs numbers vs the jsonb size budget', () => {
  test('a large-exponent number is refused', () => {
    // jsonb stores numbers as `numeric` and prints full decimal, so 1e308 is 6 bytes
    // to JSON.stringify and 300+ in the column. Measuring the client-side string let a
    // payload 20x its budget past the check and fail user_prefs_size mid-transaction.
    expect(store.sanitizePrefs({ t: 1, x: 1e308 })).toBeNull();
  });

  test('a payload that only expands once stored is refused', () => {
    const big = { t: 1 };
    for (let i = 0; i < 300; i++) big['k' + i] = 1e308;
    expect(store.sanitizePrefs(big)).toBeNull();
  });

  test('NaN and Infinity are refused rather than becoming null in the column', () => {
    expect(store.sanitizePrefs({ t: 1, x: Infinity })).toBeNull();
    expect(store.sanitizePrefs({ t: 1, x: NaN })).toBeNull();
  });

  test('the numbers this app actually stores still pass', () => {
    const real = { t: Date.now(), theme: 'mocha', sidebar: { opacity: 45, blur: 2, posX: 50 } };
    expect(store.sanitizePrefs(real)).toEqual(real);
  });

  test('deeply nested prefs are refused rather than recursed into forever', () => {
    let deep = {}; let cur = deep;
    for (let i = 0; i < 40; i++) { cur.n = {}; cur = cur.n; }
    expect(store.sanitizePrefs(deep)).toBeNull();
  });
});

describe('prefs numbers — the other tail of the exponent', () => {
  test('a tiny-exponent number is refused just like a huge one', () => {
    // 1e-300 is 6 characters to JSON.stringify and ~309 bytes once jsonb prints it as
    // numeric. Guarding only the upper bound left this exact bug reachable from below.
    expect(store.sanitizePrefs({ t: 1, x: 1e-300 })).toBeNull();
  });

  test('a payload of tiny numbers that only expands once stored is refused', () => {
    const big = { t: 1 };
    for (let i = 0; i < 200; i++) big['k' + i] = 1e-300;
    expect(store.sanitizePrefs(big)).toBeNull();
  });

  test('zero is kept — it is not a tiny magnitude', () => {
    expect(store.sanitizePrefs({ t: 1, blur: 0, opacity: 0 })).toEqual({ t: 1, blur: 0, opacity: 0 });
  });

  test('ordinary fractions this app might store still pass', () => {
    expect(store.sanitizePrefs({ t: 1, scale: 0.5, ratio: 1.25 }))
      .toEqual({ t: 1, scale: 0.5, ratio: 1.25 });
  });

  test('a legitimately null value is not mistaken for a rejected one', () => {
    // sanitizeJsonTree signals rejection with null, so it must not treat a real null
    // in the payload as a failure and discard the entire prefs blob.
    expect(store.sanitizePrefs({ t: 1, wall: null })).toEqual({ t: 1, wall: null });
  });
});

describe('uploaded wallpapers must never reach the prefs blob', () => {
  const img = 'data:image/jpeg;base64,' + 'A'.repeat(118000);

  test('a home/notes image is stripped, exactly like the sidebar one', () => {
    // It used to be stripped for `sidebar` by name, so `mainBg` — added later —
    // reintroduced the identical bug: prefs blew the 32KB column budget, sanitizePrefs
    // returned null, api/sync.js skipped the write and still answered 200. Theme, font,
    // folders and tabs then stopped syncing, silently and indefinitely.
    const out = store.sanitizePrefs({ t: 1, theme: 'mocha', mainBg: { wall: 'custom', custom: img } });
    expect(out).not.toBeNull();
    expect(out.mainBg.custom).toBeUndefined();
    expect(out.theme).toBe('mocha');            // the rest of prefs survives
  });

  test('both surfaces at once still fit', () => {
    const out = store.sanitizePrefs({
      t: 1, theme: 'mocha',
      sidebar: { wall: 'custom', custom: img },
      mainBg:  { wall: 'custom', custom: img },
    });
    expect(out).not.toBeNull();
    expect(out.sidebar.custom).toBeUndefined();
    expect(out.mainBg.custom).toBeUndefined();
  });

  test('stripping is by shape, so a future surface cannot repeat this', () => {
    const out = store.sanitizePrefs({ t: 1, someNewPanel: { wall: 'custom', custom: img } });
    expect(out).not.toBeNull();
    expect(out.someNewPanel.custom).toBeUndefined();
  });

  test('the surface’s other settings are kept', () => {
    const out = store.sanitizePrefs({ t: 1, mainBg: { wall: 'valley', opacity: 40, scrim: 70, custom: img } });
    expect(out.mainBg).toEqual({ wall: 'valley', opacity: 40, scrim: 70 });
  });

  test('a non-object or array field is left alone', () => {
    const out = store.sanitizePrefs({ t: 1, folders: ['Work'], tabs: ['a'], theme: 'mocha' });
    expect(out.folders).toEqual(['Work']);
    expect(out.tabs).toEqual(['a']);
  });
});

describe('the strip fires on the key, not on its type', () => {
  const big = 'x'.repeat(40000);

  // This exact bug shape has now appeared twice: first because the strip named one
  // field (`sidebar`) and missed `mainBg`, then because the shape check required a
  // string and missed everything else. Both times the symptom was identical — prefs
  // over budget, sanitizePrefs returns null, api/sync.js skips the write and answers
  // 200, and every preference silently stops syncing. Pinned so there is no third.
  test.each([
    ['object', { nested: big }],
    ['array',  [big]],
    ['number', 12345],
    ['null',   null],
    ['true',   true],
  ])('a %s custom value is stripped, not passed through', (_label, value) => {
    const out = store.sanitizePrefs({ t: 1, theme: 'mocha', mainBg: { wall: 'custom', custom: value } });
    expect(out).not.toBeNull();
    expect(out.mainBg.custom).toBeUndefined();
    expect(out.theme).toBe('mocha');
  });

  test('an object without a custom key is untouched', () => {
    const out = store.sanitizePrefs({ t: 1, mainBg: { wall: 'valley', scrim: 70 } });
    expect(out.mainBg).toEqual({ wall: 'valley', scrim: 70 });
  });
});
