// Stubs for globals app.js touches at require time (same as the other suites).
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');

test('themeMode classifies known light and dark themes', () => {
  expect(mod.themeMode('solarized-light')).toBe('light');
  expect(mod.themeMode('monokai')).toBe('dark');
});

test('themeMode defaults unknown themes to dark', () => {
  expect(mod.themeMode('neon-lime')).toBe('dark');
});

test('sortThemesByMode puts every light theme before every dark one, order stable', () => {
  const input = ['monokai', 'solarized-light', 'nord', 'github-light'];
  const map = { monokai: 'dark', 'solarized-light': 'light', nord: 'dark', 'github-light': 'light' };
  expect(mod.sortThemesByMode(input, map)).toEqual(['solarized-light', 'github-light', 'monokai', 'nord']);
});

test('every theme has a mode and an hljs url; the 5 new themes are present', () => {
  for (const t of mod.THEMES) {
    expect(mod.THEME_MODE[t]).toMatch(/^(light|dark)$/);
    expect(typeof mod.HLJS_THEME_URLS[t]).toBe('string');
    expect(mod.HLJS_THEME_URLS[t]).toMatch(/^https:\/\//);
  }
  for (const t of ['github-light', 'atom-one-light', 'gruvbox-light', 'solarized-dark', 'gruvbox-dark']) {
    expect(mod.THEMES).toContain(t);
  }
});
