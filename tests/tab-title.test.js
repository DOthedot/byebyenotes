/**
 * tabTitle — which name a tab shows.
 *
 * The active tab derives its name from the live blocks so it tracks what you type.
 * That branch swallowed explicit renames: renaming the note you were looking at
 * updated the sidebar but not its own tab, and only "fixed itself" once you switched
 * away. The precedence between the two sources is the whole point of this function.
 */
global.LZString = {
  compressToEncodedURIComponent: (s) => Buffer.from(s, 'utf8').toString('base64'),
  decompressFromEncodedURIComponent: (s) => Buffer.from(s, 'base64').toString('utf8'),
};
global.hljs = { highlight: (text) => ({ value: text }) };

const { tabTitle } = require('../app.js');
const blocks = (text) => [{ type: 'text', content: text, lang: null }];

test('an explicit rename wins on the tab you are looking at', () => {
  const snap = { title: 'My Chosen Name', renamed: true };
  expect(tabTitle(snap, true, blocks('# some other heading'))).toBe('My Chosen Name');
});

test('...and on a tab you are not looking at', () => {
  const snap = { title: 'My Chosen Name', renamed: true };
  expect(tabTitle(snap, false, blocks('# some other heading'))).toBe('My Chosen Name');
});

test('editing the body does not overwrite a name you set', () => {
  const snap = { title: 'My Chosen Name', renamed: true };
  expect(tabTitle(snap, true, blocks('completely different text'))).toBe('My Chosen Name');
});

test('without a rename, the active tab tracks the live content as you type', () => {
  // This is the behaviour the fix had to preserve, not remove.
  const snap = { title: 'stale stored title', renamed: false };
  expect(tabTitle(snap, true, blocks('what I am typing now'))).toBe('what I am typing now');
});

test('without a rename, an inactive tab uses its stored title', () => {
  const snap = { title: 'stored title', renamed: false };
  expect(tabTitle(snap, false, blocks('irrelevant live text'))).toBe('stored title');
});

test('clearing a rename falls back to the stored title, not the cleared one', () => {
  // applyRename re-derives and sets renamed:false, so the flag alone must decide.
  const snap = { title: 're-derived from content', renamed: false };
  expect(tabTitle(snap, false, blocks('x'))).toBe('re-derived from content');
});

test('markup is stripped from a renamed title', () => {
  const snap = { title: '# ==red:Heading==', renamed: true };
  expect(tabTitle(snap, true, blocks('x'))).toBe('Heading');
});

test('a brand-new note with no snapshot reads untitled, never blank', () => {
  expect(tabTitle(undefined, true, blocks(''))).toBe('untitled');
  expect(tabTitle(undefined, false, blocks(''))).toBe('untitled');
  expect(tabTitle(null, true, [])).toBe('untitled');
});

test('renamed:true with an empty title falls through rather than showing nothing', () => {
  expect(tabTitle({ title: '', renamed: true }, true, blocks('live text'))).toBe('live text');
});
