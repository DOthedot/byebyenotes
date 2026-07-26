// Stubs for globals app.js touches at require time (same as the other suites).
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');

const LANGS = ['python', 'javascript', 'typescript', 'sql', 'bash', 'json', 'yaml', 'go', 'rust'];

test('every language has a non-empty svg icon', () => {
  for (const l of LANGS) {
    expect(typeof mod.langIcon(l)).toBe('string');
    expect(mod.langIcon(l)).toMatch(/<svg[\s\S]*<\/svg>/);
    expect(mod.langIcon(l)).toContain('currentColor');
  }
});

test('unknown language falls back to the generic icon', () => {
  expect(mod.langIcon('cobol')).toBe(mod.langIcon('__generic__'));
  expect(mod.langIcon('cobol')).toMatch(/<svg[\s\S]*<\/svg>/);
});

test('prototype-chain keys from a crafted lang do not leak through the lookup', () => {
  // block.lang is free-form (URL-hash state), so 'constructor'/'toString' must
  // not resolve up the prototype chain to a function.
  for (const key of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
    expect(mod.langIcon(key)).toBe(mod.langIcon('__generic__'));
  }
});

test('langBadgeHtml shows the language name and its icon and a caret', () => {
  const html = mod.langBadgeHtml('python');
  expect(html).toContain('python');
  expect(html).toContain(mod.langIcon('python'));
  expect(html).toContain('caret');
});

test('langBadgeHtml escapes the language name', () => {
  expect(mod.langBadgeHtml('<x>')).toContain('&lt;x&gt;');
});
