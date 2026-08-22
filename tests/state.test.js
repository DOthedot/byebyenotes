// Mock LZString (not available in jest)
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => {
    try { return atob(s); } catch(e) { return null; }
  }
};

const { encodeState, decodeState } = require('../app.js');

const defaultState = () => ({
  blocks: [{ type: 'text', content: '' }],
  font: 'jetbrains-mono',
  theme: 'monokai'
});

test('encodeState produces a non-empty string', () => {
  const result = encodeState(defaultState());
  expect(typeof result).toBe('string');
  expect(result.length).toBeGreaterThan(0);
});

test('decodeState round-trips state', () => {
  const state = defaultState();
  state.blocks = [
    { type: 'text', content: 'hello' },
    { type: 'code', lang: 'python', content: 'print("hi")' }
  ];
  const hash = encodeState(state);
  const decoded = decodeState(hash);
  expect(decoded.blocks).toHaveLength(2);
  expect(decoded.blocks[1].lang).toBe('python');
  expect(decoded.font).toBe('jetbrains-mono');
  expect(decoded.theme).toBe('monokai');
});

test('decodeState returns null for empty hash', () => {
  expect(decodeState('')).toBeNull();
});

test('decodeState returns null for corrupt hash', () => {
  expect(decodeState('!!!not-valid!!!')).toBeNull();
});

test('only a genuinely current row is auto-selected, not a toggle badge', () => {
  // Regression: the "open on the current value" logic also matched hint:'on', which is
  // a toggle badge rather than a current value. Cmd+K opened on the badged row and a
  // reflex Enter silently flipped a setting.
  //
  // /save_before_new used to make this reachable here — it badged 'on' by default.
  // It has since been removed, and /sync (the remaining toggle) only badges once sync
  // is actually on, which this environment can't arrange. So assert the invariant
  // rather than the fixture: nothing in the command list may claim to be `current`,
  // and any badge that does appear must not.
  const list = require('../app.js').buildCommandList();
  expect(list.filter(i => i.current === true)).toHaveLength(0);
  expect(list.filter(i => i.hint === 'on').every(i => i.current !== true)).toBe(true);
});

test('the removed /save_before_new command is really gone', () => {
  // It downloaded the note you were leaving, from a prompt titled "Save as" that
  // appeared the instant you chose /newNote — so it read as naming the new note.
  const list = require('../app.js').buildCommandList();
  expect(list.find(i => i.id === 'saveBeforeNew')).toBeUndefined();
  expect(list.some(i => /save_before_new/.test(i.label || ''))).toBe(false);
});
