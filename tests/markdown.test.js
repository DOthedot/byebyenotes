global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch(e) { return null; } }
};

const {
  renderMarkdown, paintedLines, escapeHtml, toggleCheckboxLine, noteTitle, capacityLevel, timeAgo,
  stripFormatting,
} = require('../app.js');

describe('stripFormatting (re-format makes a region uniform)', () => {
  test('strips existing highlights so re-highlighting is uniform', () => {
    const s = '==green:quick== brown ==red:fox==';
    expect(stripFormatting(s, 'hl-blue')).toBe('quick brown fox');
  });
  test('repairs a broken nested-highlight run', () => {
    const s = '==red:==green:==These are phy==siological==== end';
    // no dangling == left after stripping
    expect(stripFormatting(s, 'hl-yellow')).not.toContain('==');
    expect(stripFormatting(s, 'hl-yellow')).toContain('These are physiological');
  });
  test('bold strips only bold markers, leaves highlights', () => {
    expect(stripFormatting('a **b** ==red:c==', 'bold')).toBe('a b ==red:c==');
  });
  test('italic strips lone asterisks but not bold', () => {
    expect(stripFormatting('*a* and **b**', 'italic')).toBe('a and **b**');
  });
  test('plain text is untouched', () => {
    expect(stripFormatting('nothing here', 'hl-green')).toBe('nothing here');
  });
});

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

test('strikethrough and colored highlights render', () => {
  expect(renderMarkdown('a ~~gone~~ c')).toContain('<del>gone</del>');
  expect(renderMarkdown('a ==note== c')).toContain('<mark class="hl-yellow">note</mark>');
  expect(renderMarkdown('a ==red:hot== c')).toContain('<mark class="hl-red">hot</mark>');
  expect(renderMarkdown('a ==blue:cool== c')).toContain('<mark class="hl-blue">cool</mark>');
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

test('markdown images render with width and alignment', () => {
  const plain = renderMarkdown('![pic](https://x.com/a.png)');
  expect(plain).toContain('<img src="https://x.com/a.png"');
  expect(plain).toContain('md-img left');

  const sized = renderMarkdown('![pic|400|center](https://x.com/a.png)');
  expect(sized).toContain('width:400px');
  expect(sized).toContain('md-img center');

  // Non-http(s) sources never render as images
  expect(renderMarkdown('![x](javascript:alert(1))')).not.toContain('<img');
});

test('free-positioned images render offset and rotation', () => {
  const html = renderMarkdown('![pic|300|pos:22.5,-40,-7](https://x.com/a.png)');
  expect(html).toContain('md-img free');
  expect(html).toContain('left:22.5%');
  expect(html).toContain('top:-40px');
  expect(html).toContain('rotate(-7deg)');
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

// ── The rendered layer must produce one line box per line the editable shows ──
// The markdown layer and the contenteditable swap in place on focus, so any line
// either one paints that the other does not makes the block resize as you click in
// and out — and drags the line-number gutter out of step with the text.
describe('renderMarkdown line parity with the editable', () => {
  const divs = (html) => (html.match(/<div/g) || []).length;

  test('a trailing newline does not emit an extra line', () => {
    // `white-space: pre-wrap` drops one trailing newline, so the editable paints two
    // lines here, not three. The rendered layer has to agree.
    expect(divs(renderMarkdown('- a\nb\n'))).toBe(2);
  });

  test('blank lines in the middle are kept — those ARE painted', () => {
    expect(divs(renderMarkdown('- a\n\n\nb'))).toBe(4);
  });

  test('only ONE trailing newline is dropped, matching pre-wrap', () => {
    // 'a\n\n\n' paints as: a, blank, blank. Three lines.
    expect(divs(renderMarkdown('- a\n\n\n'))).toBe(3);
  });

  test('a leading newline is kept', () => {
    expect(divs(renderMarkdown('\n- a'))).toBe(2);
  });

  test('a single line with no trailing newline is unchanged', () => {
    expect(divs(renderMarkdown('- a'))).toBe(1);
  });

  test('text that is only newlines still renders nothing', () => {
    expect(renderMarkdown('\n\n\n')).toBe('');
  });
});

// ── data-line indices must survive the trailing-newline drop ──────────────────
// renderMarkdown stamps data-line onto checkboxes and images, and toggleCheckboxLine
// indexes into the ORIGINAL text to flip one. If dropping the trailing line shifted
// those indices, clicking a checkbox would toggle a different line than the one you
// clicked — silent corruption of the user's note, which no height measurement catches.
describe('data-line indices are stable across the trailing-newline drop', () => {
  const lineAttrs = (html) => [...html.matchAll(/data-line="(\d+)"/g)].map(m => Number(m[1]));

  test('checkbox indices are identical with and without a trailing newline', () => {
    const body = '- [ ] first\nsome prose\n- [x] second';
    expect(lineAttrs(renderMarkdown(body))).toEqual(lineAttrs(renderMarkdown(body + '\n')));
  });

  test('a stamped index still addresses the same line in the source text', () => {
    const text = 'intro\n- [ ] buy milk\n- [ ] walk dog\n';
    const idxs = lineAttrs(renderMarkdown(text));
    // The second checkbox is source line 2; toggling it must hit "walk dog".
    const toggled = toggleCheckboxLine(text, idxs[1]);
    expect(toggled.split('\n')[idxs[1]]).toBe('- [x] walk dog');
    expect(toggled.split('\n')[1]).toBe('- [ ] buy milk');   // untouched
  });

  test('indices are unaffected by however many trailing newlines there are', () => {
    const body = '- [ ] a\n- [ ] b';
    const base = lineAttrs(renderMarkdown(body));
    expect(lineAttrs(renderMarkdown(body + '\n'))).toEqual(base);
    expect(lineAttrs(renderMarkdown(body + '\n\n'))).toEqual(base);
  });
});

// ── The gutter, the editable and the rendered layer must agree on line count ──
// These three drifted pairwise before: the rendered layer painted a row the editable
// did not, and the gutter numbered a row neither drew. One shared helper now answers
// the question, so a future change cannot desynchronise two of the three.
describe('paintedLines', () => {
  test('a trailing newline does not add a line — pre-wrap does not paint it', () => {
    expect(paintedLines('a\nb\n')).toEqual(['a', 'b']);
  });

  test('only one trailing newline is dropped', () => {
    expect(paintedLines('a\n\n')).toEqual(['a', '']);
  });

  test('interior blank lines are kept', () => {
    expect(paintedLines('a\n\n\nb')).toEqual(['a', '', '', 'b']);
  });

  test('a leading newline is kept', () => {
    expect(paintedLines('\na')).toEqual(['', 'a']);
  });

  test('empty and null are one empty line, never zero', () => {
    expect(paintedLines('')).toEqual(['']);
    expect(paintedLines(null)).toEqual(['']);
    expect(paintedLines(undefined)).toEqual(['']);
  });

  test('a lone newline collapses to one line, not two', () => {
    expect(paintedLines('\n')).toEqual(['']);
  });

  test('the gutter count and the rendered line count agree', () => {
    // renderMarkdown emits one div per painted line, so the two must match for any
    // input — that agreement is the whole point of sharing the helper.
    for (const text of ['- a\nb', '- a\nb\n', '- a\n\n', '\n- a', '- a\n\n\nb\n']) {
      const divs = (renderMarkdown(text).match(/<div/g) || []).length;
      expect(divs).toBe(paintedLines(text).length);
    }
  });
});
