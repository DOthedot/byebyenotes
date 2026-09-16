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

// ── markdownToBlocks ─────────────────────────────────────────────────────────
// The inverse of blocksToMarkdown. Blocks are only ever 'text' or 'code', which is
// what makes the round trip lossless — and what makes fenced regions the only
// structure this has to recognise.
describe('markdownToBlocks', () => {
  test('plain prose is one text block', () => {
    expect(mod.markdownToBlocks('hello world'))
      .toEqual([{ type: 'text', lang: null, content: 'hello world' }]);
  });

  test('a fenced block becomes a code block carrying its language', () => {
    expect(mod.markdownToBlocks('```python\nx = 1\n```'))
      .toEqual([{ type: 'code', lang: 'python', content: 'x = 1' }]);
  });

  test('a fence with no language is still code', () => {
    expect(mod.markdownToBlocks('```\nx = 1\n```'))
      .toEqual([{ type: 'code', lang: null, content: 'x = 1' }]);
  });

  test('prose and code interleave in order', () => {
    expect(mod.markdownToBlocks('intro\n\n```js\nconst a = 1;\n```\n\noutro')).toEqual([
      { type: 'text', lang: null, content: 'intro' },
      { type: 'code', lang: 'js',  content: 'const a = 1;' },
      { type: 'text', lang: null, content: 'outro' },
    ]);
  });

  test('blank lines INSIDE prose are kept — paragraphs are not separate notes', () => {
    // Splitting prose on blank lines would shatter one note into many blocks and
    // lose the distinction between a paragraph break and a block boundary.
    expect(mod.markdownToBlocks('one\n\ntwo\n\nthree'))
      .toEqual([{ type: 'text', lang: null, content: 'one\n\ntwo\n\nthree' }]);
  });

  test('an unterminated fence runs to the end rather than throwing', () => {
    expect(mod.markdownToBlocks('text\n\n```js\nconst a = 1;')).toEqual([
      { type: 'text', lang: null, content: 'text' },
      { type: 'code', lang: 'js',  content: 'const a = 1;' },
    ]);
  });

  test('an empty code block survives', () => {
    expect(mod.markdownToBlocks('```js\n```'))
      .toEqual([{ type: 'code', lang: 'js', content: '' }]);
  });

  test('a language with punctuation is kept, junk is not', () => {
    expect(mod.markdownToBlocks('```c++\nx\n```')[0].lang).toBe('c++');
    // The lang becomes a highlight.js class name, so it cannot be arbitrary text.
    expect(mod.markdownToBlocks('```<script>\nx\n```')[0].lang).toBe(null);
  });

  test('empty input yields one empty text block, never zero blocks', () => {
    // A note with no blocks cannot be opened — isOpenableSnapshot rejects it.
    expect(mod.markdownToBlocks('')).toEqual([{ type: 'text', lang: null, content: '' }]);
    expect(mod.markdownToBlocks(null)).toEqual([{ type: 'text', lang: null, content: '' }]);
  });

  test('CRLF line endings are normalised', () => {
    // A vault written on Windows, or unzipped there, arrives with \r\n.
    expect(mod.markdownToBlocks('a\r\nb')).toEqual([{ type: 'text', lang: null, content: 'a\nb' }]);
    expect(mod.markdownToBlocks('```js\r\nx = 1\r\n```')[0].content).toBe('x = 1');
  });

  test('round trip: blocks -> markdown -> blocks is identity', () => {
    const cases = [
      [{ type: 'text', lang: null, content: 'just prose' }],
      [{ type: 'code', lang: 'js', content: 'const a = 1;' }],
      [{ type: 'text', lang: null, content: 'a\n\nb' }, { type: 'code', lang: 'py', content: 'x = 1' }],
      [{ type: 'code', lang: 'js', content: 'a' }, { type: 'code', lang: 'py', content: 'b' }],
      [{ type: 'text', lang: null, content: 'before' },
       { type: 'code', lang: null, content: 'mid' },
       { type: 'text', lang: null, content: 'after' }],
    ];
    for (const blocks of cases) {
      expect(mod.markdownToBlocks(mod.blocksToMarkdown(blocks))).toEqual(blocks);
    }
  });

  test('ADJACENT TEXT BLOCKS MERGE, and that is the format, not a bug', () => {
    // blocksToMarkdown joins blocks with a blank line, so two text blocks serialise to
    // exactly what ONE block containing a blank line serialises to. Nothing in the
    // markdown distinguishes them, so importing merges. Only a fence is a real
    // boundary. Pinned deliberately: the alternative is inventing a separator that
    // would make the exported files stop being ordinary markdown.
    const two = [{ type: 'text', lang: null, content: 'one' },
                 { type: 'text', lang: null, content: 'two' }];
    expect(mod.markdownToBlocks(mod.blocksToMarkdown(two)))
      .toEqual([{ type: 'text', lang: null, content: 'one\n\ntwo' }]);
    // And the merged form is stable — importing it again changes nothing further.
    const once = mod.markdownToBlocks(mod.blocksToMarkdown(two));
    expect(mod.markdownToBlocks(mod.blocksToMarkdown(once))).toEqual(once);
  });
});

// ── parseImportFiles ─────────────────────────────────────────────────────────
// Turns a flat [{path, text}] list — from a folder picker or a zip — into notes to
// create. Additive only: every note gets a fresh nid, so an import can never
// overwrite or delete anything that is already here.
describe('parseImportFiles', () => {
  const f = (path, text = 'body') => ({ path, text });

  test('a markdown file becomes a note titled by its filename', () => {
    const { notes } = mod.parseImportFiles([f('standup.md')], null);
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe('standup');
    expect(notes[0].folder).toBe(null);
    expect(notes[0].blocks).toEqual([{ type: 'text', lang: null, content: 'body' }]);
  });

  test('directories become folders', () => {
    const { notes, folders } = mod.parseImportFiles([f('work/api/auth.md')], null);
    expect(notes[0].folder).toBe('work/api');
    expect(folders).toContain('work/api');
  });

  test('a shared root directory is stripped, so our own zip does not nest', () => {
    const { notes, folders } = mod.parseImportFiles([
      f('byebyenotes-2026-09-16/standup.md'),
      f('byebyenotes-2026-09-16/work/retro.md'),
    ], null);
    expect(notes.map(n => n.folder)).toEqual([null, 'work']);
    expect(folders).toEqual(['work']);
  });

  test('a root is only stripped when EVERY file shares it', () => {
    const { notes } = mod.parseImportFiles([f('work/a.md'), f('personal/b.md')], null);
    expect(notes.map(n => n.folder).sort()).toEqual(['personal', 'work']);
  });

  test('non-markdown files are skipped and counted', () => {
    const { notes, skipped } = mod.parseImportFiles([
      f('a.md'), f('img.png'), f('.obsidian/config.json'), f('.DS_Store'), f('notes.txt'),
    ], null);
    expect(notes).toHaveLength(1);
    expect(skipped).toBe(4);
  });

  test('the manifest supplies the real title, theme and font', () => {
    const manifest = { version: 1, notes: [
      { path: 'work/ab.md', title: 'a/b', theme: 'nord', font: 'fira-code' } ] };
    const { notes } = mod.parseImportFiles([f('work/ab.md')], manifest);
    expect(notes[0].title).toBe('a/b');       // the title the filename could not hold
    expect(notes[0].theme).toBe('nord');
    expect(notes[0].font).toBe('fira-code');
  });

  test('a STALE manifest costs metadata, never notes', () => {
    // Reorganising the vault in Obsidian moves files; the manifest keys on path.
    const manifest = { version: 1, notes: [{ path: 'old/place.md', title: 'fancy title' }] };
    const { notes } = mod.parseImportFiles([f('new/place.md')], manifest);
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe('place');     // fell back to the filename
    expect(notes[0].folder).toBe('new');
  });

  test('a corrupt manifest is ignored rather than fatal', () => {
    for (const bad of [null, undefined, 'nonsense', 42, {}, { notes: 'no' }]) {
      expect(mod.parseImportFiles([f('a.md')], bad).notes).toHaveLength(1);
    }
  });

  test('every imported note gets a FRESH nid — import never overwrites', () => {
    const manifest = { version: 1, notes: [{ path: 'a.md', nid: 'existing-nid' }] };
    const { notes } = mod.parseImportFiles([f('a.md')], manifest);
    expect(notes[0].nid).toBeTruthy();
    expect(notes[0].nid).not.toBe('existing-nid');
  });

  test('two imported files never share an nid', () => {
    const { notes } = mod.parseImportFiles(
      Array.from({ length: 50 }, (_, i) => f(`n${i}.md`)), null);
    expect(new Set(notes.map(n => n.nid)).size).toBe(50);
  });

  test('a traversing path cannot escape into a parent folder', () => {
    // The paths come from a zip a stranger could have made.
    const { notes } = mod.parseImportFiles([f('../../etc/passwd.md')], null);
    expect(notes[0].folder).not.toMatch(/\.\./);
    expect((notes[0].folder || '').startsWith('/')).toBe(false);
  });

  test('fenced code in a file survives the import', () => {
    const { notes } = mod.parseImportFiles([f('a.md', '```js\nconst a = 1;\n```')], null);
    expect(notes[0].blocks).toEqual([{ type: 'code', lang: 'js', content: 'const a = 1;' }]);
  });

  test('an empty file imports as an openable note, not as nothing', () => {
    const { notes } = mod.parseImportFiles([f('empty.md', '')], null);
    expect(notes[0].blocks.length).toBeGreaterThan(0);
  });

  test('nothing to import is an empty result, not a crash', () => {
    expect(mod.parseImportFiles([], null)).toEqual({ notes: [], folders: [], skipped: 0 });
    expect(mod.parseImportFiles(null, null).notes).toEqual([]);
  });

  test('folders are deduped and include every ancestor', () => {
    const { folders } = mod.parseImportFiles([f('a/b/c/deep.md')], null);
    expect(folders).toEqual(['a', 'a/b', 'a/b/c']);
  });
});

describe('takeManifest', () => {
  test('finds the manifest at the vault root and removes it from the notes', () => {
    const { manifest, rest } = mod.takeManifest([
      { path: 'manifest.json', text: '{"version":1,"notes":[]}' },
      { path: 'a.md', text: 'x' },
    ]);
    expect(manifest.version).toBe(1);
    expect(rest.map(f => f.path)).toEqual(['a.md']);
  });

  test('finds it under our own export root too', () => {
    const { manifest } = mod.takeManifest([
      { path: 'byebyenotes-2026-09-16/manifest.json', text: '{"version":1}' },
    ]);
    expect(manifest.version).toBe(1);
  });

  test('a manifest.json DEEPER in the tree is somebody else’s file', () => {
    // Importing a real vault that happens to contain a project's manifest.json must
    // not have that file read as ours.
    const files = [{ path: 'work/project/manifest.json', text: '{"version":9}' }];
    const { manifest, rest } = mod.takeManifest(files);
    expect(manifest).toBe(null);
    expect(rest).toHaveLength(1);
  });

  test('corrupt JSON costs metadata, not notes', () => {
    const { manifest, rest } = mod.takeManifest([
      { path: 'manifest.json', text: '{ broken' },
      { path: 'a.md', text: 'x' },
    ]);
    expect(manifest).toBe(null);
    expect(rest.map(f => f.path)).toEqual(['a.md']);
  });

  test('no manifest at all is fine', () => {
    const files = [{ path: 'a.md', text: 'x' }];
    expect(mod.takeManifest(files)).toEqual({ manifest: null, rest: files });
  });
});

describe('parseImportFiles restores empty folders', () => {
  const f = (path, text = 'body') => ({ path, text });

  test('a folder with no notes comes back from the manifest', () => {
    // Nothing in the file list implies an empty folder, so without the manifest the
    // tree loses structure every time it round-trips.
    const manifest = { version: 1, folders: ['archive/2025', 'work'], notes: [] };
    const { folders } = mod.parseImportFiles([f('work/a.md')], manifest);
    expect(folders).toContain('archive/2025');
    expect(folders).toContain('archive');
    expect(folders).toContain('work');
  });

  test('manifest folders are sanitised like any other path', () => {
    const manifest = { version: 1, folders: ['../../etc', 'work'] };
    const { folders } = mod.parseImportFiles([f('work/a.md')], manifest);
    expect(folders.every(x => !x.includes('..'))).toBe(true);
  });

  test('a junk folders field is ignored rather than fatal', () => {
    for (const bad of ['nope', 42, null, {}]) {
      expect(() => mod.parseImportFiles([f('a.md')], { folders: bad })).not.toThrow();
    }
  });
});

// ── A stored hash must carry its own nid ─────────────────────────────────────
// loadState derives the live noteId from the decoded hash and mints a fresh one when
// it is absent, so a snapshot whose hash omits nid opens under a DIFFERENT id and the
// next save writes a second copy — the imported note orphaned beside it. Pinned here
// because the rule lives in loadState, far from the three places that write a hash.
describe('imported notes carry their nid inside the hash', () => {
  test('parseImportFiles gives every note an nid to embed', () => {
    const { notes } = mod.parseImportFiles([{ path: 'a.md', text: 'x' }], null);
    expect(notes[0].nid).toMatch(/^[a-z0-9]{1,10}$/);
  });

  test('a state encoded with an nid decodes with the same nid', () => {
    const { notes } = mod.parseImportFiles([{ path: 'a.md', text: 'x' }], null);
    const n = notes[0];
    const decoded = mod.decodeState(mod.encodeState({
      nid: n.nid, blocks: n.blocks, theme: n.theme, font: n.font }));
    expect(decoded.nid).toBe(n.nid);
    expect(decoded.blocks).toEqual(n.blocks);
  });

  test('a state encoded WITHOUT an nid decodes without one — the bug shape', () => {
    // Documents why the field is load-bearing: nothing downstream can recover it.
    const decoded = mod.decodeState(mod.encodeState({ blocks: [], theme: null, font: null }));
    expect(decoded.nid).toBeUndefined();
  });
});
