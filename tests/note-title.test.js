// Stubs for globals app.js touches at require time (same as the other suites).
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');
const t = (content) => mod.noteTitle([{ content }]);

describe('noteTitle strips markup so the sidebar stays readable', () => {
  test('headings lose their hashes', () => {
    expect(t('# project notes')).toBe('project notes');
    expect(t('### deep heading')).toBe('deep heading');
  });

  test('highlight marks are removed, including the coloured form', () => {
    // These were rendering literally in the tree: "==red:# there are things".
    expect(t('==red:# there are things==')).toBe('there are things');
    expect(t('==highlighted==')).toBe('highlighted');
  });

  test('bold and italic markers are removed', () => {
    expect(t('**==blue:insdfiasndf==**')).toBe('insdfiasndf');
    expect(t('*emphasis* and **strong**')).toBe('emphasis and strong');
  });

  test('an image line becomes its alt text, not the whole URL', () => {
    expect(t('![image|480](https://byebyenotes.example/x.png)')).toBe('image');
    expect(t('![](https://example.com/y.png)')).toBe('untitled');
  });

  test('a link becomes its text', () => {
    expect(t('[the docs](https://example.com)')).toBe('the docs');
  });

  test('inline code loses its backticks', () => {
    expect(t('`npm run verify`')).toBe('npm run verify');
  });

  test('list and checkbox markers still strip, as before', () => {
    expect(t('- [ ] do the thing')).toBe('do the thing');
    expect(t('- a bullet')).toBe('a bullet');
    expect(t('> quoted')).toBe('quoted');
  });

  test('a line of pure markup falls through to the next real line', () => {
    // "/.py" came from a note whose first line was only syntax.
    expect(mod.noteTitle([{ content: '***\n\nreal title here' }])).toBe('real title here');
  });

  test('empty and markup-only notes are untitled, never blank', () => {
    expect(t('')).toBe('untitled');
    expect(t('****')).toBe('untitled');
    expect(t('   ')).toBe('untitled');
  });

  test('plain text is untouched and still capped at 48 chars', () => {
    expect(t('india is the best country')).toBe('india is the best country');
    expect(t('x'.repeat(80))).toHaveLength(48);
  });
});
