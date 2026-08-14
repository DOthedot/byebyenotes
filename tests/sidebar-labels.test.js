// Stubs for globals app.js touches at require time (same as the other suites).
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');

describe('soleLang', () => {
  test('a note written entirely in one language reports that language', () => {
    expect(mod.soleLang({ langs: ['javascript'] })).toBe('javascript');
  });

  test('a mixed-language note has no single language', () => {
    // Two code blocks in different languages: the row falls back to markdown
    // rather than claiming to be one of them.
    expect(mod.soleLang({ langs: ['javascript', 'python'] })).toBeNull();
  });

  test('prose notes and missing/absent langs are all null', () => {
    expect(mod.soleLang({ langs: [] })).toBeNull();
    expect(mod.soleLang({})).toBeNull();
    expect(mod.soleLang(undefined)).toBeNull();
  });
});

describe('fileLabel', () => {
  test('a prose note reads as markdown', () => {
    expect(mod.fileLabel('meeting notes', { langs: [] })).toBe('meeting notes.md');
  });

  test('a single-language note takes that language’s extension', () => {
    expect(mod.fileLabel('api sketch', { langs: ['javascript'] })).toBe('api sketch.js');
    expect(mod.fileLabel('scraper', { langs: ['python'] })).toBe('scraper.py');
  });

  test('an extension already in the title is not doubled up', () => {
    // Users do title notes "notes.md"; "notes.md.md" would look broken.
    expect(mod.fileLabel('notes.md', { langs: [] })).toBe('notes.md');
    expect(mod.fileLabel('Notes.MD', { langs: [] })).toBe('Notes.MD');
  });

  test('an unknown language falls back to markdown rather than an odd extension', () => {
    expect(mod.fileLabel('thing', { langs: ['brainfuck'] })).toBe('thing.md');
  });

  test('an empty or whitespace title becomes untitled', () => {
    expect(mod.fileLabel('', { langs: [] })).toBe('untitled.md');
    expect(mod.fileLabel('   ', { langs: [] })).toBe('untitled.md');
    expect(mod.fileLabel(undefined, undefined)).toBe('untitled.md');
  });
});
