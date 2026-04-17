global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch(e) { return null; } }
};

// jsdom doesn't have hljs — stub it
global.hljs = {
  highlight: (text, opts) => ({ value: text }),
};

const mod = require('../app.js');

test('createBlock returns text block with unique id', () => {
  const b1 = mod.createBlock('text');
  const b2 = mod.createBlock('text');
  expect(b1.type).toBe('text');
  expect(b1.content).toBe('');
  expect(b1.id).not.toBe(b2.id);
});

test('createBlock code block has lang', () => {
  const b = mod.createBlock('code', 'python');
  expect(b.type).toBe('code');
  expect(b.lang).toBe('python');
});

test('buildBlockEl returns div with block-content', () => {
  const b = mod.createBlock('text');
  const el = mod.buildBlockEl(b);
  expect(el.tagName).toBe('DIV');
  expect(el.classList.contains('text-block')).toBe(true);
  expect(el.querySelector('.block-content')).not.toBeNull();
});

test('buildBlockEl code block has hljs-layer and label', () => {
  const b = mod.createBlock('code', 'python');
  const el = mod.buildBlockEl(b);
  expect(el.classList.contains('code-block')).toBe(true);
  expect(el.querySelector('.hljs-layer')).not.toBeNull();
  expect(el.querySelector('.code-block-label').textContent).toBe('python');
});
