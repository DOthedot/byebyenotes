global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');

// `folder` is a free string, so a path like "work/api" expresses nesting without
// any schema change — the tree is derived by splitting on "/".
const snaps = [
  { nid: 'a', title: 'alpha', folder: 'work',          t: 4 },
  { nid: 'b', title: 'beta',  folder: 'work/api',      t: 3 },
  { nid: 'c', title: 'gamma', folder: 'work/api/v2',   t: 2 },
  { nid: 'd', title: 'delta', folder: null,            t: 1 },
];

const kinds = (rows) => rows.map(r => `${r.kind}:${r.name || r.title}@${r.depth}`);

describe('buildTreeRows nests folders by path', () => {
  test('each path segment becomes its own row at increasing depth', () => {
    const rows = mod.buildTreeRows(snaps, new Set());
    expect(kinds(rows)).toEqual([
      'folder:work@0',
      'note:alpha@1',
      'folder:api@1',
      'note:beta@2',
      'folder:v2@2',
      'note:gamma@3',
      'note:delta@0',
    ]);
  });

  test('folding a parent hides its whole subtree, not just its direct notes', () => {
    const rows = mod.buildTreeRows(snaps, new Set(['work']));
    // Only the collapsed parent and the loose note survive.
    expect(kinds(rows)).toEqual(['folder:work@0', 'note:delta@0']);
  });

  test('folding a nested folder hides only that branch', () => {
    const rows = mod.buildTreeRows(snaps, new Set(['work/api']));
    expect(kinds(rows)).toEqual([
      'folder:work@0',
      'note:alpha@1',
      'folder:api@1',
      'note:delta@0',
    ]);
  });

  test('a folder row carries its full path, so folding is unambiguous', () => {
    const rows = mod.buildTreeRows(snaps, new Set());
    const api = rows.find(r => r.kind === 'folder' && r.name === 'api');
    expect(api.path).toBe('work/api');
  });

  test('counts include notes in nested subfolders', () => {
    const rows = mod.buildTreeRows(snaps, new Set());
    expect(rows.find(r => r.name === 'work').count).toBe(3);
    expect(rows.find(r => r.name === 'api').count).toBe(2);
    expect(rows.find(r => r.name === 'v2').count).toBe(1);
  });

  test('an intermediate folder with no notes of its own still renders', () => {
    // "work" holds nothing directly; it exists only as a parent of "work/api".
    const rows = mod.buildTreeRows([{ nid: 'x', title: 'only', folder: 'work/api', t: 1 }], new Set());
    expect(kinds(rows)).toEqual(['folder:work@0', 'folder:api@1', 'note:only@2']);
  });

  test('messy paths are tolerated: slashes trimmed, blanks ignored', () => {
    const rows = mod.buildTreeRows([{ nid: 'x', title: 'n', folder: '/work//api/', t: 1 }], new Set());
    expect(kinds(rows)).toEqual(['folder:work@0', 'folder:api@1', 'note:n@2']);
  });

  test('flat folders and no folders still behave as before', () => {
    const flat = [{ nid: 'p', title: 'one', folder: 'inbox', t: 2 }, { nid: 'q', title: 'two', folder: null, t: 1 }];
    expect(kinds(mod.buildTreeRows(flat, new Set()))).toEqual(['folder:inbox@0', 'note:one@1', 'note:two@0']);
    expect(mod.buildTreeRows([], new Set())).toEqual([]);
    expect(mod.buildTreeRows(null, new Set())).toEqual([]);
  });
});

describe('folders exist in their own right, not only where notes live', () => {
  test('an explicitly created folder shows up while still empty', () => {
    // The whole complaint: "create folder" appeared to do nothing, because a
    // folder only existed as a side effect of a note being filed into it.
    const rows = mod.buildTreeRows([], new Set(), ['ideas']);
    expect(kinds(rows)).toEqual(['folder:ideas@0']);
    expect(rows[0].count).toBe(0);
  });

  test('an empty subfolder nests under its parent', () => {
    const rows = mod.buildTreeRows([], new Set(), ['work/api']);
    expect(kinds(rows)).toEqual(['folder:work@0', 'folder:api@1']);
  });

  test('explicit folders merge with folders implied by notes', () => {
    const rows = mod.buildTreeRows(
      [{ nid: 'a', title: 'alpha', folder: 'work', t: 1 }],
      new Set(),
      ['work/api', 'archive'],
    );
    expect(kinds(rows)).toEqual([
      'folder:archive@0',
      'folder:work@0',
      'note:alpha@1',
      'folder:api@1',
    ]);
  });

  test('a folder is not duplicated when notes also live in it', () => {
    const rows = mod.buildTreeRows(
      [{ nid: 'a', title: 'alpha', folder: 'work', t: 1 }],
      new Set(),
      ['work'],
    );
    expect(rows.filter(r => r.kind === 'folder' && r.name === 'work')).toHaveLength(1);
  });

  test('a missing or malformed folder list is ignored, not fatal', () => {
    expect(mod.buildTreeRows([], new Set(), null)).toEqual([]);
    expect(mod.buildTreeRows([], new Set(), ['', '  ', '///'])).toEqual([]);
    expect(mod.buildTreeRows([], new Set(), 'nope')).toEqual([]);
  });
});

test('a pathological folder path cannot blow the stack', () => {
  // `folder` arrives from localStorage and from other devices via /api/sync, so it
  // is untrusted. 50k segments previously recursed until renderSidebar threw
  // RangeError and took the whole app with it.
  const evil = Array(50000).fill('x').join('/');
  expect(() => mod.buildTreeRows([{ nid: 'e', title: 'deep', folder: evil, t: 1 }], new Set()))
    .not.toThrow();
  const rows = mod.buildTreeRows([{ nid: 'e', title: 'deep', folder: evil, t: 1 }], new Set());
  const deepest = Math.max(...rows.map(r => r.depth));
  expect(deepest).toBeLessThanOrEqual(12);
  expect(() => mod.buildTreeRows([], new Set(), [evil])).not.toThrow();
});

test('folderSegments truncates rather than trusting depth', () => {
  expect(mod.folderSegments('a/b/c')).toEqual(['a', 'b', 'c']);
  expect(mod.folderSegments(Array(40).fill('n').join('/'))).toHaveLength(12);
});
