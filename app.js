// ── Constants ─────────────────────────────────────────────────────────────────
const LANGS  = ['python', 'javascript', 'typescript', 'sql', 'bash', 'json', 'yaml', 'go', 'rust'];
const FONTS  = ['jetbrains-mono', 'fira-code', 'source-code-pro', 'ibm-plex-mono', 'roboto-mono'];
const THEMES = ['monokai', 'github-dark', 'nord', 'solarized-light', 'dracula', 'one-dark', 'tokyo-night'];

const FONT_LABELS = {
  'jetbrains-mono':  'JetBrains Mono',
  'fira-code':       'Fira Code',
  'source-code-pro': 'Source Code Pro',
  'ibm-plex-mono':   'IBM Plex Mono',
  'roboto-mono':     'Roboto Mono',
};
const FONT_CSS = {
  'jetbrains-mono':  "'JetBrains Mono', monospace",
  'fira-code':       "'Fira Code', monospace",
  'source-code-pro': "'Source Code Pro', monospace",
  'ibm-plex-mono':   "'IBM Plex Mono', monospace",
  'roboto-mono':     "'Roboto Mono', monospace",
};

const HLJS_THEME_URLS = {
  'monokai':         'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/monokai.min.css',
  'github-dark':     'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css',
  'nord':            'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/nord.min.css',
  'solarized-light': 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/solarized-light.min.css',
  'dracula':         'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/dracula.min.css',
  'one-dark':        'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css',
  'tokyo-night':     'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/tokyo-night-dark.min.css',
};

// ── App state ─────────────────────────────────────────────────────────────────
let currentFont  = 'jetbrains-mono';
let currentTheme = 'monokai';
let blocks       = [];          // [{ id, type, content, lang? }]
let nextId       = 0;
let activeBlockId = null;
let paletteOpen  = false;
let paletteMode  = null;        // 'lang' | 'font' | 'theme' | 'export' | 'filename'
let paletteIndex = 0;
let copiedTimer  = null;
let saveBeforeNew  = true;
let pendingExport  = null;  // 'md' | 'pdf' | 'docx' | 'html' | 'newNote'

// ── DOM refs (populated in DOMContentLoaded) ──────────────────────────────────
let docContainer, statusLang, statusFont, statusUrl, statusHint, statusCopied;
let paletteOverlay, paletteSearch, paletteTitle, paletteList;

// ── State encode / decode ─────────────────────────────────────────────────────
function encodeState(state) {
  return LZString.compressToEncodedURIComponent(JSON.stringify(state));
}

function decodeState(hash) {
  if (!hash) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(hash);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

// ── Block model ───────────────────────────────────────────────────────────────
function createBlock(type, lang) {
  return { id: nextId++, type, lang: lang || null, content: '' };
}

function buildBlockEl(block) {
  const div = document.createElement('div');
  div.className = `block ${block.type}-block`;
  div.dataset.id = block.id;

  if (block.type === 'code') {
    // Language label
    const label = document.createElement('span');
    label.className = 'code-block-label';
    label.textContent = block.lang;
    div.appendChild(label);

    // Highlight layer (behind)
    const pre  = document.createElement('pre');
    pre.className = 'hljs-layer';
    const code = document.createElement('code');
    pre.appendChild(code);
    div.appendChild(pre);
  }

  // Editable content layer
  const content = document.createElement('div');
  content.className = 'block-content';
  content.contentEditable = 'true';
  content.spellcheck = false;
  content.autocorrect = 'off';
  content.autocapitalize = 'off';
  if (block.content) content.innerText = block.content;
  div.appendChild(content);

  return div;
}

function getBlockEl(id) {
  return docContainer.querySelector(`[data-id="${id}"]`);
}

function getContentEl(id) {
  return getBlockEl(id).querySelector('.block-content');
}

function getBlockIdFromEl(el) {
  const block = el.closest('.block');
  return block ? Number(block.dataset.id) : null;
}

function getBlockData(id) {
  return blocks.find(b => b.id === id);
}

function renderAllBlocks() {
  docContainer.innerHTML = '';
  blocks.forEach(b => {
    const el = buildBlockEl(b);
    docContainer.appendChild(el);
    if (b.type === 'code') syncHighlight(b.id);
  });
}

function syncHighlight(blockId) {
  const block = getBlockData(blockId);
  if (!block || block.type !== 'code') return;
  const el    = getBlockEl(blockId);
  if (!el) return;
  const content = el.querySelector('.block-content');
  const code    = el.querySelector('.hljs-layer code');
  if (!content || !code) return;
  const text = content.innerText || '';
  const lang = block.lang === 'text' ? 'plaintext' : block.lang;
  try {
    code.innerHTML = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
  } catch(e) {
    code.textContent = text;
  }
}

function focusBlock(id, atEnd) {
  activeBlockId = id;
  const content = getContentEl(id);
  if (!content) return;
  content.focus();
  if (atEnd) {
    const range = document.createRange();
    range.selectNodeContents(content);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  updateStatus();
}

function insertBlockAfter(afterId, newBlock) {
  const idx = blocks.findIndex(b => b.id === afterId);
  if (idx === -1) {
    blocks.push(newBlock);
  } else {
    blocks.splice(idx + 1, 0, newBlock);
  }
  const el = buildBlockEl(newBlock);
  const afterEl = getBlockEl(afterId);
  if (afterEl && afterEl.nextSibling) {
    docContainer.insertBefore(el, afterEl.nextSibling);
  } else {
    docContainer.appendChild(el);
  }
  return newBlock;
}

// ── Theme & font ──────────────────────────────────────────────────────────────
function applyTheme(theme) {
  currentTheme = theme;
  if (theme === 'monokai') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  const link = document.getElementById('hljs-theme');
  if (link) link.href = HLJS_THEME_URLS[theme];
  // Re-sync all code blocks with new highlight theme colors
  blocks.filter(b => b.type === 'code').forEach(b => syncHighlight(b.id));
}

function applyFont(font) {
  currentFont = font;
  const css = FONT_CSS[font];
  document.body.style.fontFamily = css;
  document.getElementById('status').style.fontFamily = css;
}

// ── Command palette ───────────────────────────────────────────────────────────
function buildCommandList() {
  return [
    { id: 'lang',          label: '/box',             hint: 'change_language'              },
    { id: 'font',          label: '/font',            hint: 'change_font'                  },
    { id: 'theme',         label: '/theme',           hint: 'change_theme'                 },
    { id: 'delete',        label: '/delete',          hint: 'delete_block'                 },
    { id: 'export',        label: '/export',          hint: 'export_document'              },
    { id: 'newNote',       label: '/newNote',         hint: 'fresh_note'                   },
    { id: 'saveBeforeNew', label: '/save_before_new', hint: saveBeforeNew ? 'on' : 'off'   },
  ];
}

let paletteItems    = [];   // full item list for current mode
let paletteFiltered = [];   // filtered subset currently rendered

function openPalette(mode) {
  paletteMode  = mode;
  paletteIndex = 0;
  paletteOpen  = true;

  if (mode === 'command') {
    paletteTitle.textContent = 'Commands';
    paletteItems = buildCommandList();
  } else if (mode === 'lang') {
    paletteTitle.textContent = 'Language';
    paletteItems = LANGS.map(l => ({ id: l, label: l }));
  } else if (mode === 'font') {
    paletteTitle.textContent = 'Font';
    paletteItems = FONTS.map(f => ({ id: f, label: FONT_LABELS[f], hint: f === currentFont ? 'current' : null }));
  } else if (mode === 'theme') {
    paletteTitle.textContent = 'Theme';
    paletteItems = THEMES.map(t => ({ id: t, label: t, hint: t === currentTheme ? 'current' : null }));
  } else if (mode === 'export') {
    paletteTitle.textContent = 'Export as';
    paletteItems = [
      { id: 'md',   label: 'Markdown', hint: '.md'   },
      { id: 'pdf',  label: 'PDF',      hint: '.pdf'  },
      { id: 'docx', label: 'Word',     hint: '.docx' },
      { id: 'html', label: 'HTML',     hint: '.html' },
    ];
  } else if (mode === 'filename') {
    paletteTitle.textContent = 'Save as';
    paletteItems = [];
  }

  paletteSearch.value       = mode === 'command' ? '/' : '';
  paletteSearch.placeholder = mode === 'filename' ? 'Enter filename...' : 'Search...';
  renderPaletteList(paletteItems);
  paletteOverlay.classList.remove('hidden');
  paletteSearch.focus();
}

function renderPaletteList(items) {
  paletteFiltered = items;
  paletteIndex = Math.min(paletteIndex, Math.max(0, items.length - 1));
  paletteList.innerHTML = '';
  items.forEach((item, i) => {
    const li = document.createElement('li');
    if (item.hint) {
      const span = document.createElement('span');
      span.textContent = item.label;
      const hint = document.createElement('span');
      hint.className = 'palette-hint';
      hint.textContent = item.hint;
      li.appendChild(span);
      li.appendChild(hint);
    } else {
      li.textContent = item.label;
    }
    li.addEventListener('mousedown', (e) => { e.preventDefault(); paletteIndex = i; confirmPalette(); });
    paletteList.appendChild(li);
  });
  updatePaletteHighlight();
}

function filterPalette(query) {
  const q = query.toLowerCase();
  const filtered = q
    ? paletteItems.filter(item =>
        item.label.toLowerCase().includes(q) || (item.hint || '').toLowerCase().includes(q)
      )
    : paletteItems;
  paletteIndex = 0;
  renderPaletteList(filtered);
}

function closePalette() {
  paletteOpen = false;
  paletteMode = null;
  paletteOverlay.classList.add('hidden');
  if (activeBlockId !== null) getContentEl(activeBlockId)?.focus();
}

function updatePaletteHighlight() {
  Array.from(paletteList.children).forEach((li, i) => {
    li.classList.toggle('active', i === paletteIndex);
  });
}

function confirmPalette() {
  if (!paletteMode) return;

  // Filename mode — read directly from search input, no list needed
  if (paletteMode === 'filename') {
    const filename = paletteSearch.value.trim() || 'notes';
    closePalette();
    if (pendingExport === 'newNote') {
      exportHtmlAs(filename);
      newNote();
    } else if (pendingExport === 'md')   exportMd(filename);
    else if (pendingExport === 'pdf')    exportPdf(filename);
    else if (pendingExport === 'docx')   exportDocx(filename);
    else if (pendingExport === 'html')   exportHtmlAs(filename);
    pendingExport = null;
    return;
  }

  if (paletteFiltered.length === 0) return;
  const selected = paletteFiltered[paletteIndex];
  if (!selected) return;

  if (paletteMode === 'command') {
    if (selected.id === 'newNote') {
      if (saveBeforeNew) {
        pendingExport = 'newNote';
        openPalette('filename');
      } else {
        closePalette();
        newNote();
      }
      return;
    }
    if (selected.id === 'saveBeforeNew') {
      saveBeforeNew = !saveBeforeNew;
      closePalette();
      return;
    }
    if (selected.id === 'delete') {
      closePalette();
      if (blocks.length <= 1) return;
      const idx = blocks.findIndex(b => b.id === activeBlockId);
      const target = blocks[idx - 1] || blocks[idx + 1];
      blocks.splice(idx, 1);
      getBlockEl(activeBlockId).remove();
      focusBlock(target.id, idx > 0);
      return;
    }
    openPalette(selected.id);
    return;
  }
  if (paletteMode === 'lang') {
    const lang = selected.id;
    const newBlock = createBlock(lang === 'text' ? 'text' : 'code', lang === 'text' ? null : lang);
    insertBlockAfter(activeBlockId, newBlock);
    closePalette();
    focusBlock(newBlock.id, false);
  } else if (paletteMode === 'font') {
    applyFont(selected.id);
    closePalette();
  } else if (paletteMode === 'theme') {
    applyTheme(selected.id);
    closePalette();
  } else if (paletteMode === 'export') {
    pendingExport = selected.id;
    openPalette('filename');
  }
  updateStatus();
}

// ── URL state & status ────────────────────────────────────────────────────────
function buildShareUrl() {
  const state = {
    blocks: blocks.map(b => ({ type: b.type, content: getBlockEl(b.id)?.querySelector('.block-content')?.innerText || b.content, lang: b.lang })),
    font:  currentFont,
    theme: currentTheme,
  };
  return window.location.origin + window.location.pathname + '#' + encodeState(state);
}

function updateStatus() {
  const active = blocks.find(b => b.id === activeBlockId);
  statusLang.textContent = active ? (active.type === 'code' ? active.lang : 'text') : 'text';
  statusFont.textContent = FONT_LABELS[currentFont];

  const totalChars = blocks.reduce((sum, b) => {
    const el = getBlockEl(b.id)?.querySelector('.block-content');
    return sum + (el ? (el.innerText || '').length : b.content.length);
  }, 0);
  statusUrl.textContent = `● ${totalChars} chars`;
  statusUrl.className = '';
}

function copyShareLink() {
  const url = buildShareUrl();
  navigator.clipboard.writeText(url).then(() => {
    statusCopied.textContent = 'Copied!';
    statusCopied.classList.add('visible');
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => statusCopied.classList.remove('visible'), 1500);
  });
}

// ── Export ────────────────────────────────────────────────────────────────────
function getBlockText(b) {
  const el = getBlockEl(b.id)?.querySelector('.block-content');
  return el ? (el.innerText || '') : b.content;
}

function blocksToHtml() {
  return blocks.map(b => {
    const text = getBlockText(b);
    if (b.type === 'code') {
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre><code>${escaped}</code></pre>`;
    }
    return text.split('\n').map(line => {
      const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<p>${escaped || '&nbsp;'}</p>`;
    }).join('');
  }).join('');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportMd(filename = 'notes') {
  const md = blocks.map(b => {
    const text = getBlockText(b);
    return b.type === 'code'
      ? '```' + (b.lang || '') + '\n' + text + '\n```'
      : text;
  }).join('\n\n');
  downloadBlob(new Blob([md], { type: 'text/markdown' }), filename + '.md');
}

function exportPdf(filename = 'notes') {
  const html    = blocksToHtml();
  const fontCss = FONT_CSS[currentFont];
  const win     = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=IBM+Plex+Mono:wght@400;500&family=JetBrains+Mono:wght@400;500&family=Roboto+Mono:wght@400;500&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      body { font-family: ${fontCss}; font-size: 14px; line-height: 1.6; padding: 40px 60px; color: #222; }
      pre  { background: #f4f4f4; padding: 12px; white-space: pre-wrap; word-wrap: break-word; border-left: 3px solid #888; margin: 8px 0; }
      p    { margin: 0 0 4px; white-space: pre-wrap; }
    </style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  win.document.fonts.ready.then(() => win.print());
}

function exportHtmlAs(filename) {
  const state = {
    blocks: blocks.map(b => ({ type: b.type, content: getBlockText(b), lang: b.lang })),
    font:  currentFont,
    theme: currentTheme,
  };
  const hash    = encodeState(state);
  const siteUrl = 'https://byebyenotes.vercel.app';
  const html    = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <script>window.location.replace('${siteUrl}/#${hash}');<\/script>
</head>
<body>Opening byebyenotes...</body>
</html>`;
  downloadBlob(new Blob([html], { type: 'text/html' }), filename + '.html');
}


function newNote() {
  blocks = [createBlock('text')];
  renderAllBlocks();
  history.replaceState(null, '', window.location.pathname);
  focusBlock(blocks[0].id, false);
  updateStatus();
}

function exportDocx(filename = 'notes') {
  const fontCss  = FONT_CSS[currentFont];
  const fullHtml = `<!DOCTYPE html><html><head><style>
    body { font-family: ${fontCss}; font-size: 14px; line-height: 1.6; }
    pre  { font-family: ${fontCss}; background: #f4f4f4; padding: 8px; }
  </style></head><body>${blocksToHtml()}</body></html>`;
  const blob = htmlDocx.asBlob(fullHtml);
  downloadBlob(blob, filename + '.docx');
}

// ── Event handling ────────────────────────────────────────────────────────────
function getCaretOffset(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return 0;
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
  return range.toString().length;
}

function isCaretAtStart(el) {
  return getCaretOffset(el) === 0;
}

function isCaretAtEnd(el) {
  return getCaretOffset(el) === (el.innerText || '').length;
}

function attachEvents() {

  // Global fallback: open palette with / when no block is focused
  document.addEventListener('keydown', (e) => {
    if (paletteOpen) return;
    if (e.target.closest('.block-content')) return;
    if (e.target === paletteSearch) return;
    if (e.key === '/') {
      e.preventDefault();
      openPalette('command');
    }
  });

  // Palette search input
  paletteSearch.addEventListener('input', () => {
    filterPalette(paletteSearch.value);
  });

  paletteSearch.addEventListener('keydown', (e) => {
    const count = paletteFiltered.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      paletteIndex = (paletteIndex + 1) % count;
      updatePaletteHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      paletteIndex = (paletteIndex - 1 + count) % count;
      updatePaletteHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      confirmPalette();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (paletteMode !== 'command') {
        openPalette('command');
      } else {
        closePalette();
      }
    }
  });

  paletteOverlay.addEventListener('click', (e) => {
    if (e.target === paletteOverlay) closePalette();
  });

  // Block-level events (delegated from docContainer)
  docContainer.addEventListener('focusin', (e) => {
    const content = e.target.closest('.block-content');
    if (!content) return;
    activeBlockId = getBlockIdFromEl(content);
    updateStatus();
  });

  docContainer.addEventListener('keydown', (e) => {
    if (paletteOpen) return;
    const content = e.target.closest('.block-content');
    if (!content) return;
    const blockId   = getBlockIdFromEl(content);
    const blockData = getBlockData(blockId);
    const blockIdx  = blocks.findIndex(b => b.id === blockId);

    // Ctrl/Cmd+Shift+C — copy share link
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      copyShareLink();
      return;
    }

    // Ctrl/Cmd+Shift+↑/↓ — reorder block
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const dir     = e.key === 'ArrowUp' ? -1 : 1;
      const newIdx  = blockIdx + dir;
      if (newIdx < 0 || newIdx >= blocks.length) return;
      const swapId  = blocks[newIdx].id;
      [blocks[blockIdx], blocks[newIdx]] = [blocks[newIdx], blocks[blockIdx]];
      const currentEl = getBlockEl(blockId);
      const swapEl    = getBlockEl(swapId);
      if (dir === -1) {
        docContainer.insertBefore(currentEl, swapEl);
      } else {
        docContainer.insertBefore(swapEl, currentEl);
      }
      return;
    }

    // / — open command palette
    if (e.key === '/') {
      e.preventDefault();
      openPalette('command');
      return;
    }

    // Auto-closing pairs in code blocks
    const PAIRS = { '(': ')', '[': ']', '{': '}', "'": "'", '"': '"' };
    if (blockData.type === 'code' && !e.ctrlKey && !e.metaKey && PAIRS[e.key]) {
      e.preventDefault();
      document.execCommand('insertText', false, e.key + PAIRS[e.key]);
      window.getSelection().modify('move', 'backward', 'character');
      syncHighlight(blockId);
      return;
    }

    // Skip over closing bracket if it's already there
    const CLOSING = new Set([')', ']', '}']);
    if (blockData.type === 'code' && CLOSING.has(e.key)) {
      const sel = window.getSelection();
      if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        if (range.collapsed) {
          const node = range.startContainer;
          const offset = range.startOffset;
          const nextChar = node.nodeType === Node.TEXT_NODE
            ? node.textContent[offset]
            : null;
          if (nextChar === e.key) {
            e.preventDefault();
            sel.modify('move', 'forward', 'character');
            return;
          }
        }
      }
    }

    // Enter in code block — bracket expansion or auto-indent
    if (e.key === 'Enter' && !e.shiftKey && blockData.type === 'code') {
      e.preventDefault();
      const sel   = window.getSelection();
      const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
      const node  = range?.collapsed ? range.startContainer : null;
      const off   = range?.startOffset ?? 0;

      // In Chrome's contenteditable, each line is a <div> whose first child is a text node.
      // node.textContent.slice(0, off) reliably gives text on the current line up to cursor.
      const lineText = (node?.nodeType === Node.TEXT_NODE ? node.textContent : '');
      const lineUpToCursor = lineText.slice(0, off);
      const lastNL = lineUpToCursor.lastIndexOf('\n');
      const currentLine = lastNL === -1 ? lineUpToCursor : lineUpToCursor.slice(lastNL + 1);
      const indent = currentLine.match(/^(\s*)/)[1];

      const charBefore = lineText[off - 1] || '';
      const charAfter  = lineText[off]     || '';
      const BRACKET_PAIRS = { '(': ')', '[': ']', '{': '}' };

      if (charBefore && BRACKET_PAIRS[charBefore] === charAfter) {
        // Expand: cursor on indented inner line, closing bracket aligned with `(`
        const openCol       = currentLine.length - 1;
        const closingIndent = ' '.repeat(openCol);
        const cursorIndent  = ' '.repeat(openCol + 4);
        document.execCommand('insertText', false, '\n' + cursorIndent + '\n' + closingIndent);
        for (let i = 0; i < closingIndent.length + 1; i++) sel.modify('move', 'backward', 'character');
      } else if (currentLine.trimEnd().endsWith(':')) {
        // Python-style: indent one level deeper after colon
        document.execCommand('insertText', false, '\n' + indent + '    ');
      } else {
        // Auto-indent: match current line's leading whitespace
        document.execCommand('insertText', false, '\n' + indent);
      }
      syncHighlight(blockId);
      return;
    }

    // Shift+Enter inside code block — exit to next block
    if (e.key === 'Enter' && e.shiftKey && blockData.type === 'code') {
      e.preventDefault();
      const nextBlock = blocks[blockIdx + 1];
      if (nextBlock) {
        focusBlock(nextBlock.id, false);
      } else {
        const newText = createBlock('text');
        insertBlockAfter(blockId, newText);
        focusBlock(newText.id, false);
      }
      return;
    }

    // Tab — insert 4 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '    ');
      return;
    }

    // Backspace on empty block — delete it and focus previous (or next if first)
    if (e.key === 'Backspace') {
      const isEmpty = (content.innerText || '').trim() === '';
      if (isEmpty && blocks.length > 1) {
        e.preventDefault();
        const targetBlock = blocks[blockIdx - 1] || blocks[blockIdx + 1];
        blocks.splice(blockIdx, 1);
        getBlockEl(blockId).remove();
        focusBlock(targetBlock.id, blockIdx > 0);
        return;
      }
    }

    // Arrow navigation between blocks
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      if (isCaretAtEnd(content)) {
        const next = blocks[blockIdx + 1];
        if (next) {
          e.preventDefault();
          focusBlock(next.id, false);
          const nextContent = getContentEl(next.id);
          const range = document.createRange();
          range.setStart(nextContent, 0);
          range.collapse(true);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      if (isCaretAtStart(content)) {
        const prev = blocks[blockIdx - 1];
        if (prev) {
          e.preventDefault();
          focusBlock(prev.id, true);
        }
      }
    }
  });

  docContainer.addEventListener('input', (e) => {
    const content = e.target.closest('.block-content');
    if (!content) return;
    const blockId = getBlockIdFromEl(content);
    syncHighlight(blockId);
    updateStatus();
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
function loadState() {
  const hash  = window.location.hash.slice(1);
  const state = decodeState(hash);

  if (state && Array.isArray(state.blocks) && state.blocks.length > 0) {
    currentFont  = FONTS.includes(state.font)   ? state.font   : 'jetbrains-mono';
    currentTheme = THEMES.includes(state.theme) ? state.theme : 'monokai';
    nextId = 0;
    blocks = state.blocks.map(b => {
      const block = createBlock(b.type, b.lang);
      block.content = b.content || '';
      return block;
    });
  } else {
    blocks = [createBlock('text')];
  }

  applyFont(currentFont);
  applyTheme(currentTheme);
  renderAllBlocks();

  if (blocks.length > 0) focusBlock(blocks[0].id, false);
}

document.addEventListener('DOMContentLoaded', () => {
  docContainer   = document.getElementById('document-container');
  statusLang     = document.getElementById('status-lang');
  statusFont     = document.getElementById('status-font');
  statusUrl      = document.getElementById('status-url');
  statusHint     = document.getElementById('status-hint');
  statusCopied   = document.getElementById('status-copied');
  paletteOverlay = document.getElementById('palette-overlay');
  paletteSearch  = document.getElementById('palette-search');
  paletteTitle   = document.getElementById('palette-title');
  paletteList    = document.getElementById('palette-list');

  statusHint.textContent = 'Ctrl+Shift+C copy  |  / commands  |  Shift+Enter exit block  |  Ctrl+Shift+↑↓ reorder';

  loadState();
  attachEvents();
  updateStatus();
});

// ── Export for tests (no-op in browser) ──────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { encodeState, decodeState, createBlock, buildBlockEl };
}
