global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');

test('defaults are returned for missing, empty, and non-object input', () => {
  for (const bad of [undefined, null, {}, 'nope', 42, []]) {
    expect(mod.normalizeSidebarCfg(bad)).toEqual(mod.SIDEBAR_DEFAULTS);
  }
});

test('numeric values are clamped to their allowed range', () => {
  const cfg = mod.normalizeSidebarCfg({ opacity: 900, blur: -5, bright: 0, sat: 9999, scrim: -1 });
  expect(cfg.opacity).toBe(100);
  expect(cfg.blur).toBe(0);
  expect(cfg.bright).toBe(30);
  expect(cfg.sat).toBe(200);
  expect(cfg.scrim).toBe(0);
});

test('non-numeric values fall back to the default rather than NaN', () => {
  const cfg = mod.normalizeSidebarCfg({ opacity: 'abc', blur: null });
  expect(cfg.opacity).toBe(mod.SIDEBAR_DEFAULTS.opacity);
  expect(cfg.blur).toBe(mod.SIDEBAR_DEFAULTS.blur);
});

test('an unknown wallpaper id falls back to none, a known one is kept', () => {
  expect(mod.normalizeSidebarCfg({ wall: 'not-a-wall' }).wall).toBe('none');
  const known = mod.WALLPAPERS[1].id;
  expect(mod.normalizeSidebarCfg({ wall: known }).wall).toBe(known);
});

test('position accepts only top/center/bottom', () => {
  expect(mod.normalizeSidebarCfg({ pos: 'top' }).pos).toBe('top');
  expect(mod.normalizeSidebarCfg({ pos: 'sideways' }).pos).toBe('center');
});

test('open is coerced to a boolean', () => {
  expect(mod.normalizeSidebarCfg({ open: 0 }).open).toBe(false);
  expect(mod.normalizeSidebarCfg({ open: 'yes' }).open).toBe(true);
});

test('every wallpaper has an id, a name and a css string; none is first', () => {
  expect(mod.WALLPAPERS[0].id).toBe('none');
  for (const w of mod.WALLPAPERS) {
    expect(typeof w.id).toBe('string');
    expect(typeof w.name).toBe('string');
    expect(typeof w.css).toBe('string');
  }
});

test('sidebarCssVars emits every custom property as a string', () => {
  const vars = mod.sidebarCssVars(mod.normalizeSidebarCfg({ opacity: 50, blur: 4, pos: 'top' }));
  expect(Object.keys(vars).sort()).toEqual(
    ['--sb-blur', '--sb-bright', '--sb-img', '--sb-opacity', '--sb-pos', '--sb-sat', '--sb-scrim'].sort()
  );
  Object.values(vars).forEach(v => expect(typeof v).toBe('string'));
  expect(vars['--sb-opacity']).toBe('0.5');
  expect(vars['--sb-blur']).toBe('4px');
  expect(vars['--sb-pos']).toBe('top');
});

test('sidebarCssVars maps the none wallpaper to the css keyword none', () => {
  expect(mod.sidebarCssVars(mod.normalizeSidebarCfg({ wall: 'none' }))['--sb-img']).toBe('none');
});
