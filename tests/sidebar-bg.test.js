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

test('panning is two clamped percentages, not a three-stop enum', () => {
  // Replaced top/center/bottom: a fixed enum could not pan a tall image, which is
  // the whole point of a portrait wallpaper in a narrow panel.
  const cfg = mod.normalizeSidebarCfg({ posX: 20, posY: 80 });
  expect(cfg.posX).toBe(20);
  expect(cfg.posY).toBe(80);
  const clamped = mod.normalizeSidebarCfg({ posX: -40, posY: 900 });
  expect(clamped.posX).toBe(0);
  expect(clamped.posY).toBe(100);
  expect(mod.normalizeSidebarCfg({ posX: 'nope' }).posX).toBe(mod.SIDEBAR_DEFAULTS.posX);
});

test('a custom image is accepted only as a base64 image data URI', () => {
  // This value reaches a CSS url(); it arrives from localStorage and from other
  // devices via /api/sync, so anything not self-produced must be rejected.
  const ok = 'data:image/jpeg;base64,AAAA';
  expect(mod.normalizeSidebarCfg({ custom: ok }).custom).toBe(ok);
  for (const bad of [
    'https://example.com/x.jpg',
    'data:text/html;base64,PHNjcmlwdD4=',
    'url(evil)',
    'data:image/jpeg;base64,<script>',
    42, null, {},
  ]) {
    expect(mod.normalizeSidebarCfg({ custom: bad }).custom).toBe('');
  }
});

test('the custom wallpaper id is allowed alongside the built-ins', () => {
  expect(mod.normalizeSidebarCfg({ wall: 'custom' }).wall).toBe('custom');
  expect(mod.normalizeSidebarCfg({ wall: 'not-real' }).wall).toBe('none');
});

test('open is coerced to a boolean', () => {
  expect(mod.normalizeSidebarCfg({ open: 0 }).open).toBe(false);
  expect(mod.normalizeSidebarCfg({ open: 'yes' }).open).toBe(true);
});

test('SIDEBAR_LOOK_DEFAULTS covers appearance only — not open, not the upload', () => {
  expect(mod.SIDEBAR_LOOK_DEFAULTS).not.toHaveProperty('open');
  // `custom` is excluded too: resetting the look must not throw away an image the
  // user uploaded, which they'd then have to find and re-pick.
  expect(mod.SIDEBAR_LOOK_DEFAULTS).not.toHaveProperty('custom');
  expect(Object.keys(mod.SIDEBAR_LOOK_DEFAULTS).sort())
    .toEqual(['blur', 'bright', 'opacity', 'posX', 'posY', 'sat', 'scrim', 'wall']);
  Object.entries(mod.SIDEBAR_LOOK_DEFAULTS).forEach(([k, v]) => {
    expect(v).toBe(mod.SIDEBAR_DEFAULTS[k]);
  });
});

test('resetting the look leaves a hidden sidebar hidden', () => {
  // What "reset background" now patches onto the live config: appearance snaps back
  // to defaults, `open: false` survives.
  const hidden = mod.normalizeSidebarCfg({ open: false, opacity: 90, blur: 8, wall: mod.WALLPAPERS[1].id });
  const after  = mod.normalizeSidebarCfg(Object.assign({}, hidden, mod.SIDEBAR_LOOK_DEFAULTS));
  expect(after.open).toBe(false);
  expect(after.opacity).toBe(mod.SIDEBAR_DEFAULTS.opacity);
  expect(after.wall).toBe('none');
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
  const vars = mod.sidebarCssVars(mod.normalizeSidebarCfg({ opacity: 50, blur: 4 }));
  expect(Object.keys(vars).sort()).toEqual(
    ['--sb-blur', '--sb-bright', '--sb-img', '--sb-opacity', '--sb-pos', '--sb-sat', '--sb-scrim'].sort()
  );
  Object.values(vars).forEach(v => expect(typeof v).toBe('string'));
  expect(vars['--sb-opacity']).toBe('0.5');
  expect(vars['--sb-blur']).toBe('4px');
  expect(vars['--sb-pos']).toBe('50% 50%');
});

test('sidebarCssVars maps the none wallpaper to the css keyword none', () => {
  expect(mod.sidebarCssVars(mod.normalizeSidebarCfg({ wall: 'none' }))['--sb-img']).toBe('none');
});

describe('normalizeTextCfg — font sizes reach a CSS length, so clamp them', () => {
  const { normalizeTextCfg, TEXT_DEFAULTS, TEXT_RANGES } = mod;

  test('defaults for missing, empty and non-object input', () => {
    for (const bad of [undefined, null, {}, 'nope', 42, []]) {
      expect(normalizeTextCfg(bad)).toEqual(TEXT_DEFAULTS);
    }
  });

  test('values are clamped to their range rather than trusted', () => {
    // An unclamped value here makes the app unreadable with no way back to the
    // control that caused it — and this arrives from other devices via /api/sync.
    const big = normalizeTextCfg({ size: 9999, ui: 9999 });
    expect(big.size).toBe(TEXT_RANGES.size[1]);
    expect(big.ui).toBe(TEXT_RANGES.ui[1]);
    const small = normalizeTextCfg({ size: -50, ui: 0 });
    expect(small.size).toBe(TEXT_RANGES.size[0]);
    expect(small.ui).toBe(TEXT_RANGES.ui[0]);
  });

  test('half-steps survive — they matter at these sizes', () => {
    expect(normalizeTextCfg({ size: 13.5, ui: 12.5 })).toEqual({ size: 13.5, ui: 12.5 });
    expect(normalizeTextCfg({ size: 13.7 }).size).toBe(13.5);
  });

  test('junk in one field does not poison the other', () => {
    expect(normalizeTextCfg({ size: 'huge', ui: 11 })).toEqual({ size: TEXT_DEFAULTS.size, ui: 11 });
  });

  test('NaN and Infinity fall back to the default', () => {
    expect(normalizeTextCfg({ size: NaN, ui: Infinity })).toEqual(TEXT_DEFAULTS);
  });

  test('the default renders the app exactly as it was before the feature', () => {
    // 14px/12.5px are the values that were hardcoded in style.css.
    expect(TEXT_DEFAULTS).toEqual({ size: 14, ui: 12.5 });
  });
});
