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

describe('normalizeSurfaceBg — the home screen and the note surface', () => {
  const { normalizeSurfaceBg, SURFACE_BG_DEFAULTS, wallpapersFor } = mod;

  test('both default to no image, so nothing changes until someone picks one', () => {
    for (const surface of ['home', 'note']) {
      for (const bad of [undefined, null, {}, 'nope', 42, []]) {
        expect(normalizeSurfaceBg(surface, bad)).toEqual(SURFACE_BG_DEFAULTS[surface]);
      }
      expect(SURFACE_BG_DEFAULTS[surface].wall).toBe('none');
    }
  });

  test('the note surface is the most conservative of the three', () => {
    // It is the one you stare at for an hour, so it starts dimmer and more scrimmed
    // than the landing page, which in turn is calmer than the decorative side panel.
    expect(SURFACE_BG_DEFAULTS.note.scrim).toBeGreaterThan(SURFACE_BG_DEFAULTS.home.scrim);
    expect(SURFACE_BG_DEFAULTS.note.bright).toBeLessThan(SURFACE_BG_DEFAULTS.home.bright);
    expect(SURFACE_BG_DEFAULTS.home.scrim).toBeGreaterThan(mod.SIDEBAR_DEFAULTS.scrim);
  });

  test('values are clamped to the shared ranges', () => {
    const big = normalizeSurfaceBg('home', { opacity: 900, blur: -5, bright: 0, sat: 9999, scrim: -1 });
    expect(big.opacity).toBe(100);
    expect(big.blur).toBe(0);
    expect(big.bright).toBe(30);
    expect(big.sat).toBe(200);
    expect(big.scrim).toBe(0);
  });

  test('blur keeps its half-steps here too', () => {
    expect(normalizeSurfaceBg('note', { blur: 1.5 }).blur).toBe(1.5);
    expect(normalizeSurfaceBg('note', { blur: 1.26 }).blur).toBe(1.5);
  });

  test('an unknown wallpaper id degrades to none', () => {
    expect(normalizeSurfaceBg('home', { wall: 'aurora' }).wall).toBe('none');
    expect(normalizeSurfaceBg('note', { wall: '../../etc/passwd' }).wall).toBe('none');
  });

  test('every wallpaper a surface offers is accepted by it', () => {
    for (const surface of ['home', 'note']) {
      for (const w of wallpapersFor(surface)) {
        expect(normalizeSurfaceBg(surface, { wall: w.id }).wall).toBe(w.id);
      }
    }
  });

  test('a custom image must be a data URI we could have produced', () => {
    expect(normalizeSurfaceBg('home', { custom: 'data:image/jpeg;base64,AAAA' }).custom)
      .toBe('data:image/jpeg;base64,AAAA');
    expect(normalizeSurfaceBg('home', { custom: 'https://example.com/x.png' }).custom).toBe('');
    expect(normalizeSurfaceBg('note', { custom: 'javascript:alert(1)' }).custom).toBe('');
  });

  test('neither carries the sidebar-only width', () => {
    expect(normalizeSurfaceBg('home', { width: 400 })).not.toHaveProperty('width');
    expect(normalizeSurfaceBg('note', { width: 400 })).not.toHaveProperty('width');
  });

  test('an unknown surface falls back rather than throwing', () => {
    expect(() => normalizeSurfaceBg('nonsense', {})).not.toThrow();
  });
});

describe('custom image fingerprint', () => {
  const { customFingerprint } = mod;
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
    const cfg = mod.normalizeSurfaceBg('home', { custom: a, customId: 'lies' });
    expect(cfg.customId).toBe(customFingerprint(a));
  });

  test('a rejected image leaves an empty fingerprint, not a stale one', () => {
    const cfg = mod.normalizeSurfaceBg('home', { custom: 'https://example.com/x.png', customId: 'stale' });
    expect(cfg.custom).toBe('');
    expect(cfg.customId).toBe('');
  });
});

describe('each surface offers its own wallpapers', () => {
  const { wallpapersFor, normalizeSidebarCfg, normalizeSurfaceBg, SIDEBAR_DEFAULTS } = mod;
  const ids = (surface) => wallpapersFor(surface).map(w => w.id);

  test('the side panel keeps the photographic set', () => {
    expect(ids('side')).toEqual(expect.arrayContaining(['glory', 'storm', 'knight', 'stars']));
  });

  test('home offers only vortex, valley and city', () => {
    expect(ids('home').filter(id => id !== 'none')).toEqual(['vortex', 'valley', 'city']);
  });

  test('notes offers only terminal', () => {
    expect(ids('note').filter(id => id !== 'none')).toEqual(['grid']);
  });

  test('terminal is on both the panel and notes; the others are not shared', () => {
    expect(ids('side')).toContain('grid');
    expect(ids('note')).toContain('grid');
    for (const id of ['vortex', 'valley', 'city']) expect(ids('side')).not.toContain(id);
  });

  test('every surface offers "none", or a background could not be turned off', () => {
    for (const surface of ['side', 'home', 'note']) expect(ids(surface)).toContain('none');
  });

  test('a wallpaper another surface owns is rejected, not rendered', () => {
    // Reachable from an older build or a device on a different version, via sync.
    expect(normalizeSurfaceBg('note', { wall: 'valley' }).wall).toBe('none');
    expect(normalizeSurfaceBg('home', { wall: 'grid' }).wall).toBe('none');
    expect(normalizeSidebarCfg({ wall: 'valley' }).wall).toBe(SIDEBAR_DEFAULTS.wall);
  });

  test('an uploaded image is allowed anywhere — it is not in the list', () => {
    const img = 'data:image/jpeg;base64,AAAA';
    for (const surface of ['home', 'note']) {
      expect(normalizeSurfaceBg(surface, { wall: 'custom', custom: img }).wall).toBe('custom');
    }
    expect(normalizeSidebarCfg({ wall: 'custom', custom: img }).wall).toBe('custom');
  });

  test('a wallpaper with no `on` declared is offered everywhere', () => {
    // Guards the failure mode where adding an entry and forgetting the field makes it
    // invisible in every picker with no error.
    const undeclared = mod.WALLPAPERS.filter(w => !Array.isArray(w.on));
    for (const w of undeclared) {
      for (const surface of ['side', 'home', 'note']) expect(ids(surface)).toContain(w.id);
    }
  });
});

describe('the old single mainBg setting is honoured', () => {
  const { normalizeSurfaceBg, wallpapersFor } = mod;

  test('a value legal for the new surface carries across', () => {
    // home & notes were one setting for one release. Someone who picked a background
    // then should keep it, not silently find it reset to none.
    const old = { wall: 'valley', opacity: 42, scrim: 72, bright: 70 };
    const seeded = normalizeSurfaceBg('home', old);
    expect(seeded.wall).toBe('valley');
    expect(seeded.opacity).toBe(42);
    expect(seeded.scrim).toBe(72);
  });

  test('...and one that is not legal for that surface still degrades', () => {
    // valley is offered on home, not on notes — carrying it across must not smuggle a
    // wallpaper past the per-surface list.
    expect(wallpapersFor('note').map(w => w.id)).not.toContain('valley');
    expect(normalizeSurfaceBg('note', { wall: 'valley', scrim: 72 }).wall).toBe('none');
    // the numeric settings still carry, only the wallpaper is refused
    expect(normalizeSurfaceBg('note', { wall: 'valley', scrim: 72 }).scrim).toBe(72);
  });
});

// ── The sync payload's two competing jobs ────────────────────────────────────
// A push must strip device-local images out of `prefs` (they are pure waste on a
// two-second autosave, and the server drops them anyway) while still delivering the
// sidebar wallpaper in its own `sidebarImage` field when it has actually changed.
// Those pull in opposite directions on the same string, and the ordering between them
// is the whole trick — so it is pinned here rather than left to a reader's eye.
describe('buildSyncPrefs', () => {
  const img = 'data:image/png;base64,' + 'A'.repeat(400);

  test('strips custom images at every depth, keeping the fingerprint', () => {
    const { prefs } = mod.buildSyncPrefs({
      theme: 'dark',
      sidebar:    { wall: 'custom', custom: img },
      mainBg:     { wall: 'custom', custom: img },   // the one-release-old key
      surfaceBg:  { home: { wall: 'custom', custom: img }, note: { wall: 'none', custom: '' } },
    }, false);
    expect(prefs.sidebar.custom).toBe('');
    expect(prefs.mainBg.custom).toBe('');
    expect(prefs.surfaceBg.home.custom).toBe('');
    expect(prefs.theme).toBe('dark');
    // The marker is what tells another device whether a 'custom' wall refers to a
    // picture that device actually holds, so it must outlive the image.
    expect(prefs.surfaceBg.home.customId).toBe(mod.customFingerprint(img));
  });

  test('the sidebar image still travels when it is dirty', () => {
    const { sidebarImage } = mod.buildSyncPrefs({ sidebar: { wall: 'custom', custom: img } }, true);
    // Regression: stripping used to run before this was read, so a freshly picked
    // wallpaper went up as `null` — which the server reads as "clear it".
    expect(sidebarImage).toBe(img);
  });

  test('a dirty push with no image sends null, and a clean push sends nothing', () => {
    expect(mod.buildSyncPrefs({ sidebar: { wall: 'none', custom: '' } }, true).sidebarImage).toBeNull();
    expect(mod.buildSyncPrefs({ sidebar: { custom: img } }, false).sidebarImage).toBeUndefined();
  });

  test('the input is not mutated — localStorage still holds the image', () => {
    const src = { sidebar: { wall: 'custom', custom: img } };
    mod.buildSyncPrefs(src, true);
    expect(src.sidebar.custom).toBe(img);
  });
});
