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

describe('sidebar width — the panel is resizable, so the value is user-driven', () => {
  const { normalizeSidebarCfg, SIDEBAR_DEFAULTS, SIDEBAR_LOOK_DEFAULTS } = mod;

  test('defaults when absent', () => {
    expect(normalizeSidebarCfg({}).width).toBe(SIDEBAR_DEFAULTS.width);
    expect(normalizeSidebarCfg(undefined).width).toBe(264);
  });

  test('clamped at both ends', () => {
    // The width drives a grid column. Unclamped, a synced 0 hides the panel with no
    // handle left to drag back, and a huge value pushes the editor off screen.
    expect(normalizeSidebarCfg({ width: 0 }).width).toBe(180);
    expect(normalizeSidebarCfg({ width: -500 }).width).toBe(180);
    expect(normalizeSidebarCfg({ width: 99999 }).width).toBe(560);
  });

  test('a value in range is kept, rounded to a whole pixel', () => {
    expect(normalizeSidebarCfg({ width: 300 }).width).toBe(300);
    expect(normalizeSidebarCfg({ width: 300.6 }).width).toBe(301);
  });

  test('junk falls back to the default', () => {
    expect(normalizeSidebarCfg({ width: 'wide' }).width).toBe(SIDEBAR_DEFAULTS.width);
    expect(normalizeSidebarCfg({ width: null }).width).toBe(SIDEBAR_DEFAULTS.width);
    expect(normalizeSidebarCfg({ width: NaN }).width).toBe(SIDEBAR_DEFAULTS.width);
  });

  test('"reset background" does not resize the panel', () => {
    // Width is panel state the user set deliberately, like `open` and `custom` —
    // not part of "the background looks wrong, undo it".
    expect(SIDEBAR_LOOK_DEFAULTS).not.toHaveProperty('width');
    expect(SIDEBAR_LOOK_DEFAULTS).not.toHaveProperty('open');
    expect(SIDEBAR_LOOK_DEFAULTS).not.toHaveProperty('custom');
  });
});

describe('a wallpaper id that no longer exists', () => {
  const { normalizeSidebarCfg, SIDEBAR_DEFAULTS, WALLPAPERS } = mod;

  test('a removed preset falls back to the default rather than breaking', () => {
    // dusk/aurora/sakura/ember/abyss were removed from the picker. Anyone who had one
    // selected still has that id in prefs — and on another device, in synced prefs —
    // so it must degrade to "none" instead of leaving --sb-img pointing at nothing.
    for (const gone of ['dusk', 'aurora', 'sakura', 'ember', 'abyss']) {
      expect(normalizeSidebarCfg({ wall: gone }).wall).toBe(SIDEBAR_DEFAULTS.wall);
    }
  });

  test('the removed presets really are gone from the picker', () => {
    const ids = WALLPAPERS.map(w => w.id);
    for (const gone of ['dusk', 'aurora', 'sakura', 'ember', 'abyss']) {
      expect(ids).not.toContain(gone);
    }
  });

  test('the CSS-art presets that were kept still work', () => {
    expect(normalizeSidebarCfg({ wall: 'grid' }).wall).toBe('grid');
    expect(normalizeSidebarCfg({ wall: 'stars' }).wall).toBe('stars');
  });

  test('an uploaded image is still accepted — it is not in WALLPAPERS by design', () => {
    expect(normalizeSidebarCfg({ wall: 'custom' }).wall).toBe('custom');
  });
});

describe('blur steps in halves', () => {
  const { normalizeSidebarCfg, SIDEBAR_STEPS } = mod;

  test('blur is the one bar with a half step', () => {
    expect(SIDEBAR_STEPS.blur).toBe(0.5);
    expect(SIDEBAR_STEPS.opacity).toBeUndefined();   // percentages stay whole
  });

  test('a half-pixel blur survives normalisation', () => {
    // It used to be Math.round()ed away, so 0.5 read back as 1 and the half-steps
    // were unreachable no matter what the slider did.
    expect(normalizeSidebarCfg({ blur: 0.5 }).blur).toBe(0.5);
    expect(normalizeSidebarCfg({ blur: 2.5 }).blur).toBe(2.5);
  });

  test('values snap to the nearest half, not to the nearest whole', () => {
    expect(normalizeSidebarCfg({ blur: 0.6 }).blur).toBe(0.5);
    expect(normalizeSidebarCfg({ blur: 0.8 }).blur).toBe(1);
    expect(normalizeSidebarCfg({ blur: 1.24 }).blur).toBe(1);
    expect(normalizeSidebarCfg({ blur: 1.26 }).blur).toBe(1.5);
  });

  test('the range is still clamped', () => {
    expect(normalizeSidebarCfg({ blur: -3 }).blur).toBe(0);
    expect(normalizeSidebarCfg({ blur: 999 }).blur).toBe(24);
  });

  test('bars without a step still land on whole numbers', () => {
    expect(normalizeSidebarCfg({ opacity: 45.4 }).opacity).toBe(45);
    expect(normalizeSidebarCfg({ scrim: 55.6 }).scrim).toBe(56);
    expect(normalizeSidebarCfg({ width: 300.5 }).width).toBe(301);
  });
});

describe('normalizeMainBg — the home screen and note background', () => {
  const { normalizeMainBg, MAIN_BG_DEFAULTS, WALLPAPERS } = mod;

  test('defaults to no image, so nothing changes until someone picks one', () => {
    for (const bad of [undefined, null, {}, 'nope', 42, []]) {
      expect(normalizeMainBg(bad)).toEqual(MAIN_BG_DEFAULTS);
    }
    expect(MAIN_BG_DEFAULTS.wall).toBe('none');
  });

  test('defaults are gentler than the sidebar’s — this is a surface you write on', () => {
    // Dim text (checked list items, comments) is what disappears first over a busy
    // image, so the note surface starts with a heavier scrim and lower brightness.
    expect(MAIN_BG_DEFAULTS.scrim).toBeGreaterThan(mod.SIDEBAR_DEFAULTS.scrim);
    expect(MAIN_BG_DEFAULTS.bright).toBeLessThan(mod.SIDEBAR_DEFAULTS.bright);
  });

  test('values are clamped to the shared ranges', () => {
    const big = normalizeMainBg({ opacity: 900, blur: -5, bright: 0, sat: 9999, scrim: -1 });
    expect(big.opacity).toBe(100);
    expect(big.blur).toBe(0);
    expect(big.bright).toBe(30);
    expect(big.sat).toBe(200);
    expect(big.scrim).toBe(0);
  });

  test('blur keeps its half-steps here too', () => {
    expect(normalizeMainBg({ blur: 1.5 }).blur).toBe(1.5);
    expect(normalizeMainBg({ blur: 1.26 }).blur).toBe(1.5);
  });

  test('an unknown wallpaper id degrades to none', () => {
    expect(normalizeMainBg({ wall: 'aurora' }).wall).toBe('none');
    expect(normalizeMainBg({ wall: '../../etc/passwd' }).wall).toBe('none');
  });

  test('every real wallpaper is accepted', () => {
    for (const w of WALLPAPERS) expect(normalizeMainBg({ wall: w.id }).wall).toBe(w.id);
  });

  test('a custom image must be a data URI we could have produced', () => {
    // Same guard as the sidebar's: this string goes straight into a CSS url(), and a
    // synced prefs blob is untrusted input.
    expect(normalizeMainBg({ custom: 'data:image/jpeg;base64,AAAA' }).custom)
      .toBe('data:image/jpeg;base64,AAAA');
    expect(normalizeMainBg({ custom: 'https://example.com/x.png' }).custom).toBe('');
    expect(normalizeMainBg({ custom: 'javascript:alert(1)' }).custom).toBe('');
    expect(normalizeMainBg({ custom: `url(x);background:url(evil)` }).custom).toBe('');
  });

  test('it does not carry the sidebar-only width', () => {
    // width sizes a grid column and belongs to the panel alone; leaking it here would
    // put a meaningless key in prefs and in every sync payload.
    expect(normalizeMainBg({ width: 400 })).not.toHaveProperty('width');
  });
});

test('the valley wallpaper is registered and is the light one', () => {
  expect(mod.WALLPAPERS.find(w => w.id === 'valley')).toBeTruthy();
});

describe('custom image fingerprint', () => {
  const { customFingerprint, normalizeMainBg } = mod;
  const a = 'data:image/jpeg;base64,' + 'A'.repeat(2000);
  const b = 'data:image/jpeg;base64,' + 'B'.repeat(2000);

  test('the same image fingerprints the same', () => {
    expect(customFingerprint(a)).toBe(customFingerprint(a));
  });

  test('different images of identical length differ', () => {
    // Length alone would collide here, which is the case that matters: two devices
    // that each uploaded a photo at the same JPEG budget.
    expect(a.length).toBe(b.length);
    expect(customFingerprint(a)).not.toBe(customFingerprint(b));
  });

  test('a single changed byte changes it', () => {
    expect(customFingerprint(a)).not.toBe(customFingerprint(a.slice(0, -1) + 'B'));
  });

  test('no image means no fingerprint', () => {
    expect(customFingerprint('')).toBe('');
    expect(customFingerprint(null)).toBe('');
    expect(customFingerprint(undefined)).toBe('');
  });

  test('it is derived from the image, never taken from input', () => {
    // A synced blob could otherwise claim any fingerprint it liked and make another
    // device adopt a 'custom' wall for a picture it does not have.
    const cfg = normalizeMainBg({ custom: a, customId: 'lies' });
    expect(cfg.customId).toBe(customFingerprint(a));
  });

  test('a rejected image leaves an empty fingerprint, not a stale one', () => {
    const cfg = normalizeMainBg({ custom: 'https://example.com/x.png', customId: 'stale' });
    expect(cfg.custom).toBe('');
    expect(cfg.customId).toBe('');
  });
});
