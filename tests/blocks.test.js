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

test('buildBlockEl code block has hljs-layer and language badge', () => {
  const b = mod.createBlock('code', 'python');
  const el = mod.buildBlockEl(b);
  expect(el.classList.contains('code-block')).toBe(true);
  expect(el.querySelector('.hljs-layer')).not.toBeNull();
  expect(el.querySelector('.lang-badge').textContent).toContain('python');
});

test('buildBlockEl text block has markdown layer', () => {
  const b = mod.createBlock('text');
  const el = mod.buildBlockEl(b);
  expect(el.querySelector('.md-layer')).not.toBeNull();
});

// A fresh empty text block, id-injected so insertDividerBlocks stays pure/testable.
function makeBlockFactory(start = 100) {
  let id = start;
  return () => ({ id: ++id, type: 'text', lang: null, content: '' });
}

test('insertDividerBlocks preserves the block text and adds a divider after it', () => {
  // Regression guard for #21: inserting a divider used to overwrite the block.
  const blocks = [{ id: 1, type: 'text', lang: null, content: 'hello world' }];
  const { blocks: out, focusId } = mod.insertDividerBlocks(blocks, 1, 'hello world', makeBlockFactory());
  expect(out.map(b => b.content)).toEqual(['hello world', '---', '']);
  expect(out[0].content).toBe('hello world'); // the data that used to be lost
  expect(focusId).toBe(out[2].id);            // focus the fresh trailing block
});

test('insertDividerBlocks turns an empty block into the divider itself', () => {
  const blocks = [{ id: 1, type: 'text', lang: null, content: '' }];
  const { blocks: out, focusId } = mod.insertDividerBlocks(blocks, 1, '', makeBlockFactory());
  expect(out.map(b => b.content)).toEqual(['---', '']);
  expect(focusId).toBe(out[1].id);
});

test('insertDividerBlocks treats a whitespace-only block as empty', () => {
  const blocks = [{ id: 1, type: 'text', lang: null, content: '   ' }];
  const { blocks: out } = mod.insertDividerBlocks(blocks, 1, '   ', makeBlockFactory());
  expect(out.map(b => b.content)).toEqual(['---', '']);
});

test('insertDividerBlocks does not mutate the original blocks array or its text', () => {
  const blocks = [{ id: 1, type: 'text', lang: null, content: 'keep me' }];
  mod.insertDividerBlocks(blocks, 1, 'keep me', makeBlockFactory());
  expect(blocks).toHaveLength(1);
  expect(blocks[0].content).toBe('keep me');
});

test('insertDividerBlocks inserts after the active block, keeping later blocks', () => {
  const blocks = [
    { id: 1, type: 'text', lang: null, content: 'a' },
    { id: 2, type: 'text', lang: null, content: 'b' },
  ];
  const { blocks: out } = mod.insertDividerBlocks(blocks, 1, 'a', makeBlockFactory());
  expect(out.map(b => b.content)).toEqual(['a', '---', '', 'b']);
});
