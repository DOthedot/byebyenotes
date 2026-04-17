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
