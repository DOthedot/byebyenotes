global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };
const mod = require('../app.js');

// ── syncState ────────────────────────────────────────────────────────────────
// The status bar shows three things that used to be indistinguishable: sync is off,
// sync is on and current, and sync is on but NOT getting through. The third was
// previously a toast that vanished in 1.5 seconds, after which a broken connection
// looked exactly like a working one.
describe('syncState', () => {
  const s = (over) => mod.syncState(Object.assign(
    { hasKey: true, pending: 0, failing: false, lastOkAt: 1000, now: 1000 }, over));

  test('no passphrase is plainly off', () => {
    const st = s({ hasKey: false });
    expect(st.tone).toBe('off');
    expect(st.label).toMatch(/off/);
  });

  test('off wins even when notes are unsent — they are not going anywhere', () => {
    // Without a key there is no server to be behind, so "unsent" would be a lie.
    expect(s({ hasKey: false, pending: 5, failing: true }).tone).toBe('off');
  });

  test('on and caught up', () => {
    const st = s({});
    expect(st.tone).toBe('ok');
    expect(st.label).toMatch(/on/);
  });

  test('a push in flight is NOT a warning — edits are pending for 2s by design', () => {
    // PUSH_DELAY means every edit is briefly unsent. Warning about that would make
    // the indicator cry wolf on every keystroke.
    const st = s({ pending: 3 });
    expect(st.tone).toBe('ok');
  });

  test('a failed push is a warning, and says how many are waiting', () => {
    const st = s({ pending: 3, failing: true });
    expect(st.tone).toBe('warn');
    expect(st.label).toMatch(/3/);
  });

  test('failing with nothing pending still warns — the connection is still down', () => {
    const st = s({ pending: 0, failing: true });
    expect(st.tone).toBe('warn');
  });

  test('the title explains rather than just flagging', () => {
    expect(s({ pending: 2, failing: true }).title).toMatch(/retry/i);
    expect(s({ hasKey: false }).title).toMatch(/passphrase|\/sync/i);
  });

  test('singular and plural read correctly', () => {
    expect(s({ pending: 1, failing: true }).label).toMatch(/1 unsent/);
    expect(s({ pending: 2, failing: true }).label).toMatch(/2 unsent/);
  });

  test('a long outage reports how stale it is, not a raw timestamp', () => {
    const st = s({ failing: true, lastOkAt: 0, now: 3 * 60 * 60 * 1000 });
    expect(st.title).toMatch(/h|hour/);
  });

  test('never synced at all is not reported as stale-since-epoch', () => {
    const st = s({ failing: true, lastOkAt: null, now: 5000 });
    expect(st.title).not.toMatch(/1970|56 years/);
  });
});

// A narrow status bar hides its other segments; this one shortens instead, because
// hiding a problem report on a phone hides it where a flaky connection is likeliest.
describe('syncState short form', () => {
  const s = (over) => mod.syncState(Object.assign(
    { hasKey: true, pending: 0, failing: false, lastOkAt: 1000, now: 1000 }, over));

  test('every state has one', () => {
    expect(s({ hasKey: false }).short).toBeTruthy();
    expect(s({}).short).toBeTruthy();
    expect(s({ failing: true, pending: 2 }).short).toBeTruthy();
  });

  test('it is genuinely shorter than the full label', () => {
    for (const st of [s({ hasKey: false }), s({}), s({ failing: true, pending: 12 })]) {
      expect(st.short.length).toBeLessThan(st.label.length);
    }
  });

  test('the warning survives being shortened', () => {
    expect(s({ failing: true, pending: 3 }).short).toMatch(/⚠/);
    expect(s({ failing: true, pending: 3 }).short).toMatch(/3/);
  });
});

// agoLabel is what turns "last synced" into something readable in a bar with no room
// for a timestamp. Boundaries tested directly rather than through syncState's title,
// because an off-by-one here shows the user "0m ago" or "60m ago" instead of "1h ago".
describe('agoLabel', () => {
  const m = 60 * 1000, h = 60 * m, d = 24 * h;

  test('under a minute reads as just now', () => {
    expect(mod.agoLabel(0)).toBe('just now');
    expect(mod.agoLabel(59 * 1000)).toBe('just now');
  });

  test('minutes, up to the hour boundary', () => {
    expect(mod.agoLabel(m)).toBe('1m ago');
    expect(mod.agoLabel(59 * m)).toBe('59m ago');
  });

  test('hours, up to the day boundary', () => {
    expect(mod.agoLabel(h)).toBe('1h ago');
    expect(mod.agoLabel(23 * h)).toBe('23h ago');
  });

  test('days beyond that', () => {
    expect(mod.agoLabel(d)).toBe('1d ago');
    expect(mod.agoLabel(9 * d)).toBe('9d ago');
  });

  test('nonsense input yields nothing rather than NaN', () => {
    // A clock that moved backwards would otherwise render "-3m ago".
    for (const bad of [-1, NaN, Infinity, null, undefined, 'x']) {
      expect(mod.agoLabel(bad)).toBe('');
    }
  });
});
