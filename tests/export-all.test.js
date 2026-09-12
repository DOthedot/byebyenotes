global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');

describe('blocksToMarkdown', () => {
  test('a text block is emitted verbatim', () => {
    expect(mod.blocksToMarkdown([{ type: 'text', content: 'hello' }])).toBe('hello');
  });

  test('a code block is fenced with its language', () => {
    expect(mod.blocksToMarkdown([{ type: 'code', lang: 'python', content: 'x = 1' }]))
      .toBe('```python\nx = 1\n```');
  });

  test('a code block with no language still gets fences', () => {
    expect(mod.blocksToMarkdown([{ type: 'code', lang: null, content: 'x = 1' }]))
      .toBe('```\nx = 1\n```');
  });

  test('blocks are separated by a blank line', () => {
    const md = mod.blocksToMarkdown([
      { type: 'text', content: 'intro' },
      { type: 'code', lang: 'js', content: 'const a = 1;' },
      { type: 'text', content: 'outro' },
    ]);
    expect(md).toBe('intro\n\n```js\nconst a = 1;\n```\n\noutro');
  });

  test('an empty block list is an empty string, not a crash', () => {
    expect(mod.blocksToMarkdown([])).toBe('');
    expect(mod.blocksToMarkdown(null)).toBe('');
  });

  test('a block with no content contributes an empty line, not "undefined"', () => {
    expect(mod.blocksToMarkdown([{ type: 'text' }])).toBe('');
    expect(mod.blocksToMarkdown([{ type: 'code', lang: 'js' }])).toBe('```js\n\n```');
  });
});

describe('safeFileName', () => {
  test('an ordinary title passes through', () => {
    expect(mod.safeFileName('meeting notes', 'x')).toBe('meeting notes');
  });

  test('characters illegal on Windows and macOS are stripped', () => {
    expect(mod.safeFileName('a/b\\c:d*e?f"g<h>i|j', 'x')).toBe('abcdefghij');
  });

  test('trailing dots and spaces are trimmed — Windows rejects them', () => {
    expect(mod.safeFileName('  notes...  ', 'x')).toBe('notes');
  });

  test('whitespace runs collapse, including newlines', () => {
    expect(mod.safeFileName('a \n\t  b', 'x')).toBe('a b');
  });

  test('an over-long title is capped at 80 characters', () => {
    expect(mod.safeFileName('a'.repeat(200), 'x').length).toBe(80);
  });

  test('a title that sanitises to nothing falls back to the nid', () => {
    expect(mod.safeFileName('///', 'abc123')).toBe('abc123');
    expect(mod.safeFileName('', 'abc123')).toBe('abc123');
    expect(mod.safeFileName(null, 'abc123')).toBe('abc123');
  });

  test('with neither a usable title nor a fallback it still returns a name', () => {
    expect(mod.safeFileName('', '')).toBe('untitled');
  });

  test('a name that is all dots cannot escape to a parent directory', () => {
    // '..' as a filename would write outside its folder when the zip is unpacked.
    expect(mod.safeFileName('..', 'nid1')).toBe('nid1');
    expect(mod.safeFileName('.', 'nid1')).toBe('nid1');
  });
});

describe('buildExportTree', () => {
  // The LZString stub above makes a hash a base64 JSON blob; build one the same way.
  const mkHash = (blocks, extra = {}) =>
    btoa(JSON.stringify({ blocks, theme: null, font: null, ...extra }));
  const snap = (over = {}) => ({
    nid: 'n1', title: 'alpha', folder: null, renamed: true,
    hash: mkHash([{ type: 'text', content: 'hello' }]),
    ...over,
  });

  test('a loose note lands at the root as a .md file', () => {
    const { files } = mod.buildExportTree([snap()], []);
    expect(files).toEqual([{ path: 'alpha.md', text: 'hello' }]);
  });

  test('a folder path becomes nested directories', () => {
    expect(mod.buildExportTree([snap({ folder: 'work/api' })], []).files[0].path)
      .toBe('work/api/alpha.md');
  });

  test('two notes with the same title in one folder get suffixed', () => {
    const { files } = mod.buildExportTree(
      [snap({ nid: 'n1' }), snap({ nid: 'n2' }), snap({ nid: 'n3' })], []);
    expect(files.map(f => f.path)).toEqual(['alpha.md', 'alpha (2).md', 'alpha (3).md']);
  });

  test('the same title in DIFFERENT folders is not suffixed', () => {
    const { files } = mod.buildExportTree(
      [snap({ nid: 'n1', folder: 'a' }), snap({ nid: 'n2', folder: 'b' })], []);
    expect(files.map(f => f.path)).toEqual(['a/alpha.md', 'b/alpha.md']);
  });

  test('empty folders are listed so the vault matches the sidebar', () => {
    expect(mod.buildExportTree([], ['work', 'work/api', 'personal']).manifest.folders)
      .toEqual(['personal', 'work', 'work/api']);
  });

  test('folders implied by notes are listed too, without duplicates', () => {
    expect(mod.buildExportTree([snap({ folder: 'work/api' })], ['work']).manifest.folders)
      .toEqual(['work', 'work/api']);
  });

  test('the manifest records the real written path and the metadata', () => {
    const { manifest } = mod.buildExportTree([snap({
      title: 'a/b', folder: 'work',
      hash: mkHash([{ type: 'text', content: 'x' }], { theme: 'nord', font: 'fira-code' }),
    })], []);
    expect(manifest.notes[0]).toEqual({
      path: 'work/ab.md', nid: 'n1', title: 'a/b', renamed: true,
      theme: 'nord', font: 'fira-code', folder: 'work',
    });
    expect(manifest.version).toBe(1);
    expect(typeof manifest.exported).toBe('string');
  });

  test('an undecodable note is skipped and counted, not exported empty', () => {
    const { files, skipped } = mod.buildExportTree([snap({ hash: 'not-base64!!' })], []);
    expect(files).toEqual([]);
    expect(skipped).toBe(1);
  });

  test('a code block round-trips as a fenced block', () => {
    const { files } = mod.buildExportTree([snap({
      hash: mkHash([{ type: 'code', lang: 'js', content: 'const a = 1;' }]),
    })], []);
    expect(files[0].text).toBe('```js\nconst a = 1;\n```');
  });

  test('a stray-slash folder is normalised, not written as empty directories', () => {
    expect(mod.buildExportTree([snap({ folder: '//work//api//' })], []).files[0].path)
      .toBe('work/api/alpha.md');
  });

  test('a note with no nid is ignored rather than written as "undefined.md"', () => {
    const { files } = mod.buildExportTree([snap({ nid: null }), snap()], []);
    expect(files.map(f => f.path)).toEqual(['alpha.md']);
  });

  test('missing inputs produce an empty tree, not a crash', () => {
    const { files, manifest, skipped } = mod.buildExportTree(null, null);
    expect(files).toEqual([]);
    expect(manifest.folders).toEqual([]);
    expect(skipped).toBe(0);
  });
});

describe('loadScriptOnce', () => {
  beforeEach(() => { document.head.innerHTML = ''; mod.__resetScriptCache(); });

  test('injects one script tag and resolves on load', async () => {
    const p = mod.loadScriptOnce('https://example.test/a.js');
    const tags = document.head.querySelectorAll('script');
    expect(tags.length).toBe(1);
    expect(tags[0].src).toBe('https://example.test/a.js');
    tags[0].dispatchEvent(new Event('load'));
    await expect(p).resolves.toBeUndefined();
  });

  test('a second call for the same url does not inject a second tag', async () => {
    const a = mod.loadScriptOnce('https://example.test/a.js');
    const b = mod.loadScriptOnce('https://example.test/a.js');
    expect(document.head.querySelectorAll('script').length).toBe(1);
    expect(a).toBe(b);
    document.head.querySelector('script').dispatchEvent(new Event('load'));
    await Promise.all([a, b]);
  });

  test('a failed load rejects AND is not cached, so a retry can succeed', async () => {
    const p = mod.loadScriptOnce('https://example.test/bad.js');
    document.head.querySelector('script').dispatchEvent(new Event('error'));
    await expect(p).rejects.toThrow();
    // Caching the rejection would make every retry fail for the rest of the session
    // without touching the network — a dropped connection would be permanent.
    const again = mod.loadScriptOnce('https://example.test/bad.js');
    expect(again).not.toBe(p);
    await expect(Promise.race([again, Promise.resolve('pending')])).resolves.toBe('pending');
  });

  test('a failed load removes its tag, so the DOM does not collect dead scripts', async () => {
    const p = mod.loadScriptOnce('https://example.test/bad.js');
    document.head.querySelector('script').dispatchEvent(new Event('error'));
    await expect(p).rejects.toThrow();
    expect(document.head.querySelectorAll('script').length).toBe(0);
  });

  test('different urls get their own tags and promises', async () => {
    const a = mod.loadScriptOnce('https://example.test/a.js');
    const b = mod.loadScriptOnce('https://example.test/b.js');
    expect(document.head.querySelectorAll('script').length).toBe(2);
    expect(a).not.toBe(b);
    document.head.querySelectorAll('script').forEach(s => s.dispatchEvent(new Event('load')));
    await Promise.all([a, b]);
  });
});

// ── Paths are untrusted input ────────────────────────────────────────────────
// A note's `folder` syncs from other devices (AGENTS.md gotcha 9) and its title is
// typed by hand. Both become path segments inside a zip that someone later unpacks,
// so a '..' that survives writes outside the export directory — Zip Slip.
describe('export paths cannot escape the vault', () => {
  const mkHash = (blocks) => btoa(JSON.stringify({ blocks, theme: null, font: null }));
  const snap = (over = {}) => ({
    nid: 'n1', title: 'alpha', folder: null, renamed: true,
    hash: mkHash([{ type: 'text', content: 'hi' }]), ...over,
  });

  test('a traversing folder cannot climb out of the export root', () => {
    const { files } = mod.buildExportTree([snap({ folder: '../../etc' })], []);
    expect(files[0].path).not.toMatch(/\.\./);
    expect(files[0].path.startsWith('/')).toBe(false);
  });

  test('.. segments are dropped, the real ones survive', () => {
    expect(mod.buildExportTree([snap({ folder: 'work/../../../api' })], []).files[0].path)
      .toBe('work/api/alpha.md');
  });

  test('a lone .. folder collapses to the root, not an empty directory name', () => {
    expect(mod.buildExportTree([snap({ folder: '..' })], []).files[0].path).toBe('alpha.md');
  });

  test('a traversing folder is also cleaned in the manifest folder list', () => {
    const { manifest } = mod.buildExportTree([], ['../../etc', 'work/../x']);
    expect(manifest.folders.every(f => !f.includes('..'))).toBe(true);
    expect(manifest.folders).toContain('work/x');
  });

  test('the folder recorded on a note matches the path actually written', () => {
    const { files, manifest } = mod.buildExportTree([snap({ folder: '../work' })], []);
    expect(files[0].path).toBe('work/alpha.md');
    expect(manifest.notes[0].folder).toBe('work');
  });
});

describe('safeFileName guards Windows reserved device names', () => {
  test('a bare device name falls back rather than becoming an unwritable file', () => {
    // CON.md is still reserved on Windows — the device name is matched before the
    // extension, so appending .md does not rescue it.
    for (const name of ['CON', 'con', 'PRN', 'aux', 'NUL', 'COM1', 'lpt9']) {
      expect(mod.safeFileName(name, 'nid1')).toBe('nid1');
    }
  });

  test('a name that merely contains a device name is fine', () => {
    expect(mod.safeFileName('console notes', 'nid1')).toBe('console notes');
    expect(mod.safeFileName('aux-notes', 'nid1')).toBe('aux-notes');
  });
});

describe('safePathSegments keeps folder names meaningful', () => {
  test('a folder named like a device keeps its name, suffixed to stay writable', () => {
    expect(mod.safePathSegments('con/aux')).toEqual(['con_', 'aux_']);
  });

  test('a segment of pure junk is dropped, not turned into "untitled"', () => {
    expect(mod.safePathSegments('work/***/api')).toEqual(['work', 'api']);
  });

  test('ordinary folders are untouched', () => {
    expect(mod.safePathSegments('work/api/v2')).toEqual(['work', 'api', 'v2']);
  });

  test('traversal segments are removed', () => {
    expect(mod.safePathSegments('../work/../api')).toEqual(['work', 'api']);
  });

  test('empty input is an empty path, not a crash', () => {
    expect(mod.safePathSegments(null)).toEqual([]);
    expect(mod.safePathSegments('')).toEqual([]);
  });
});

// ── The fallback is untrusted too ────────────────────────────────────────────
// Every caller passes the note's nid as the fallback, which LOOKS trustworthy and is
// not: loadState() takes nid straight from a decoded share-link hash with no
// validation and saveSnapshot stores it verbatim, so a crafted link can put '../..'
// in it. It becomes the filename for any note whose title sanitises away.
describe('safeFileName sanitises its fallback, not just its title', () => {
  test('a traversing fallback cannot produce a traversing name', () => {
    const out = mod.safeFileName('///', '../../etc/passwd');
    expect(out).not.toMatch(/\.\./);
    expect(out).not.toMatch(/[\/\\]/);
  });

  test('a reserved-name fallback is rejected too', () => {
    expect(mod.safeFileName('', 'CON')).toBe('untitled');
  });

  test('when title and fallback are both unusable the name is still safe', () => {
    expect(mod.safeFileName('...', '../..')).toBe('untitled');
    expect(mod.safeFileName(null, null)).toBe('untitled');
  });

  test('an ordinary nid fallback still works', () => {
    expect(mod.safeFileName('///', 'k8lpavwl')).toBe('k8lpavwl');
  });

  test('end to end: a malicious nid cannot escape the export root', () => {
    const h = btoa(JSON.stringify({ blocks: [{ type: 'text', content: 'x' }] }));
    const { files } = mod.buildExportTree(
      [{ nid: '../../../../tmp/evil', title: '///', hash: h }], []);
    expect(files[0].path).not.toMatch(/\.\./);
    expect(files[0].path.startsWith('/')).toBe(false);
  });
});

// Windows refuses paths over 260 characters. The FILENAME yields to the budget,
// because the manifest records the note's true title so nothing is lost by shortening
// it. Folder names deliberately do NOT yield: truncating them would merge two folders
// whose names share a prefix into one directory, and silently losing a folder is worse
// than an extraction error the user can see. See "Known limits" in the plan.
describe('export path length', () => {
  const h = btoa(JSON.stringify({ blocks: [{ type: 'text', content: 'x' }] }));

  test('a long title is shortened to fit the budget', () => {
    const { files } = mod.buildExportTree(
      [{ nid: 'n1', title: 'a'.repeat(300), folder: 'work', hash: h }], []);
    expect(files[0].path.length).toBeLessThanOrEqual(200);
    expect(files[0].path.startsWith('work/a')).toBe(true);
    expect(files[0].path.endsWith('.md')).toBe(true);
  });

  test('the shortened name never ends in a dot or space', () => {
    // 'x'.repeat(n) + ' .' would slice to a trailing space on some budgets, which
    // Windows silently drops — producing a different filename than the manifest says.
    const { files, manifest } = mod.buildExportTree(
      [{ nid: 'n1', title: 'b'.repeat(150) + ' . . .', folder: 'work', hash: h }], []);
    expect(files[0].path).not.toMatch(/[. ]\.md$/);
    expect(manifest.notes[0].path).toBe(files[0].path);
  });

  test('the manifest still records the untruncated title', () => {
    const long = 'c'.repeat(300);
    const { manifest } = mod.buildExportTree(
      [{ nid: 'n1', title: long, folder: null, hash: h }], []);
    expect(manifest.notes[0].title).toBe(long);
    expect(manifest.notes[0].path.length).toBeLessThanOrEqual(200);
  });

  test('a normal path is not truncated', () => {
    const { files } = mod.buildExportTree(
      [{ nid: 'n1', title: 'meeting notes', folder: 'work/api', hash: h }], []);
    expect(files[0].path).toBe('work/api/meeting notes.md');
  });

  test('even against an absurd folder the filename keeps a usable stub', () => {
    const deep = Array.from({ length: 12 }, (_, i) => ('folder' + i).repeat(9)).join('/');
    const { files } = mod.buildExportTree(
      [{ nid: 'n1', title: 'd'.repeat(200), folder: deep, hash: h }], []);
    const name = files[0].path.split('/').pop();
    expect(name.length).toBeLessThanOrEqual(11);   // 8-char floor + '.md'
    expect(name.endsWith('.md')).toBe(true);
  });
});
