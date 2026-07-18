global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch(e) { return null; } }
};

const {
  renderMarkdown, escapeHtml, toggleCheckboxLine, noteTitle, capacityLevel, timeAgo,
} = require('../app.js');

// ── renderMarkdown ──
test('plain text renders nothing (no markdown layer needed)', () => {
  expect(renderMarkdown('just a plain line')).toBe('');
  expect(renderMarkdown('')).toBe('');
  expect(renderMarkdown('   ')).toBe('');
});

test('headings render with dim marker and level class', () => {
  const html = renderMarkdown('# Title');
  expect(html).toContain('md-h1');
  expect(html).toContain('<span class="md-mark">#</span>');
  expect(html).toContain('Title');
  expect(renderMarkdown('## Sub')).toContain('md-h2');
  expect(renderMarkdown('### Deep')).toContain('md-h3');
});

test('bullets, checkboxes, dividers render', () => {
  expect(renderMarkdown('- item')).toContain('md-li');
  expect(renderMarkdown('- [ ] todo')).toContain('md-check');
  expect(renderMarkdown('- [x] done')).toContain('md-check done');
  expect(renderMarkdown('---')).toContain('md-divider');
});

test('inline bold, italic, code render', () => {
  expect(renderMarkdown('a **b** c')).toContain('<strong>b</strong>');
  expect(renderMarkdown('a *b* c')).toContain('<em>b</em>');
  expect(renderMarkdown('a `code` c')).toContain('<code class="md-code">code</code>');
});

test('html in content is escaped', () => {
  const html = renderMarkdown('# <script>alert(1)</script>');
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
});

test('checkbox lines carry their source line index', () => {
  const html = renderMarkdown('# head\n- [ ] first\n- [x] second');
  expect(html).toContain('data-line="1"');
  expect(html).toContain('data-line="2"');
});

// ── toggleCheckboxLine ──
test('toggleCheckboxLine flips unchecked to checked and back', () => {
  const src = '- [ ] task\n- [x] other';
  expect(toggleCheckboxLine(src, 0)).toBe('- [x] task\n- [x] other');
  expect(toggleCheckboxLine(src, 1)).toBe('- [ ] task\n- [ ] other');
  expect(toggleCheckboxLine(src, 5)).toBe(src); // out of range: unchanged
});

// ── noteTitle ──
test('noteTitle strips markdown markers and truncates', () => {
  expect(noteTitle([{ content: '# My Note\nbody' }])).toBe('My Note');
  expect(noteTitle([{ content: '- [ ] task one' }])).toBe('task one');
  expect(noteTitle([{ content: '' }, { content: 'second block' }])).toBe('second block');
  expect(noteTitle([{ content: '' }])).toBe('untitled');
});

// ── capacityLevel ──
test('capacityLevel thresholds', () => {
  expect(capacityLevel(100).level).toBe('green');
  expect(capacityLevel(5600).level).toBe('amber');
  expect(capacityLevel(7500).level).toBe('red');
  expect(capacityLevel(20000).ratio).toBe(1);
});

// ── timeAgo ──
test('timeAgo formats relative time', () => {
  const now = 1_000_000_000_000;
  expect(timeAgo(now - 30 * 1000, now)).toBe('just now');
  expect(timeAgo(now - 5 * 60 * 1000, now)).toBe('5m ago');
  expect(timeAgo(now - 3 * 3600 * 1000, now)).toBe('3h ago');
  expect(timeAgo(now - 2 * 86400 * 1000, now)).toBe('2d ago');
});

// ── escapeHtml ──
test('escapeHtml escapes angle brackets, amps, quotes', () => {
  expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});
