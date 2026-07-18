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

const URL_SAFE_LIMIT = 8000;   // conservative cross-browser URL length budget
const QR_MAX_CHARS   = 2800;   // QR version 40, level L, 8-bit capacity ≈ 2953
const SNAP_KEY       = 'bbn.recent';
const SNAP_MAX       = 8;
const SYNC_DELAY     = 800;

// ── App state ─────────────────────────────────────────────────────────────────
let currentFont  = 'jetbrains-mono';
let currentTheme = 'monokai';
let blocks       = [];          // [{ id, type, content, lang? }]
let nextId       = 0;
let noteId       = null;        // stable id for snapshot dedupe, travels in the URL
let activeBlockId = null;
let paletteOpen  = false;
let paletteMode  = null;        // 'command' | 'insert' | 'lang' | 'changeLang' | 'font' | 'theme' | 'export' | 'filename'
let paletteIndex = 0;
let paletteAnchor = null;       // {x, y} viewport coords for caret-anchored palette
let changeLangTarget = null;    // block id whose language is being changed
let copiedTimer  = null;
let saveBeforeNew  = true;
let pendingExport  = null;      // 'md' | 'pdf' | 'docx' | 'html' | 'newNote'
let focusMode    = false;
let shareOpen    = false;
let emptyVisible = false;
let syncTimer    = null;
let lastUrlLen   = 0;

// ── DOM refs (populated in DOMContentLoaded) ──────────────────────────────────
let docContainer, statusMode, statusLang, statusFont, statusUrl, statusUrlFill,
    statusUrlText, statusHint, statusCopied;
let paletteOverlay, paletteEl, paletteSearch, paletteTitle, paletteList;
let emptyState, recentSection, recentList, exampleLink;
let shareOverlay, shareCard, shareLinkEl, shareQr, capFill, capText;
let fab;

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

// ── Pure helpers (exported for tests) ─────────────────────────────────────────
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderInlineMd(escaped) {
  return escaped
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

// Line-based markdown renderer. Returns '' when nothing renders differently
// from plain text, so plain blocks skip the render layer entirely.
function renderMarkdown(text) {
  if (!text || !text.trim()) return '';
  const lines = text.split('\n');
  let anyMd = false;
  const html = lines.map((line, i) => {
    let m;
    if ((m = line.match(/^(#{1,3}) (.*)$/))) {
      anyMd = true;
      const lvl = m[1].length;
      return `<div class="md-h md-h${lvl}"><span class="md-mark">${m[1]}</span> ${renderInlineMd(escapeHtml(m[2]))}</div>`;
    }
    if (/^---+\s*$/.test(line)) {
      anyMd = true;
      return '<div class="md-divider"></div>';
    }
    if ((m = line.match(/^- \[([ xX])\] (.*)$/))) {
      anyMd = true;
      const done = m[1] !== ' ';
      return `<div class="md-check${done ? ' done' : ''}" data-line="${i}"><span class="cb">${done ? '✓' : ''}</span><span>${renderInlineMd(escapeHtml(m[2]))}</span></div>`;
    }
    if ((m = line.match(/^- (.*)$/))) {
      anyMd = true;
      return `<div class="md-li"><span class="md-mark">–</span> ${renderInlineMd(escapeHtml(m[1]))}</div>`;
    }
    const inline = renderInlineMd(escapeHtml(line));
    if (inline !== escapeHtml(line)) anyMd = true;
    return `<div class="md-p">${inline || '&nbsp;'}</div>`;
  }).join('');
  return anyMd ? html : '';
}

function toggleCheckboxLine(text, lineIdx) {
  const lines = text.split('\n');
  const line = lines[lineIdx];
  if (line === undefined) return text;
  if (/^- \[ \] /.test(line))       lines[lineIdx] = line.replace('- [ ] ', '- [x] ');
  else if (/^- \[[xX]\] /.test(line)) lines[lineIdx] = line.replace(/^- \[[xX]\] /, '- [ ] ');
  return lines.join('\n');
}

function noteTitle(blockList) {
  for (const b of blockList) {
    const line = (b.content || '').split('\n').find(l => l.trim() && !/^---+\s*$/.test(l));
    if (line) {
      return line.replace(/^#{1,3} /, '').replace(/^- \[[ xX]\] /, '').replace(/^- /, '').trim().slice(0, 48);
    }
  }
  return 'untitled';
}

function capacityLevel(urlLen) {
  const ratio = Math.min(urlLen / URL_SAFE_LIMIT, 1);
  const level = ratio < 0.6 ? 'green' : ratio < 0.85 ? 'amber' : 'red';
  return { ratio, level };
}

function timeAgo(t, now = Date.now()) {
  const s = Math.floor((now - t) / 1000);
  if (s < 60)      return 'just now';
  if (s < 3600)    return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)   return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Recent-note snapshots (localStorage) ──────────────────────────────────────
function loadSnapshots() {
  try {
    const arr = JSON.parse(localStorage.getItem(SNAP_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveSnapshot(snap) {
  try {
    const list = loadSnapshots().filter(s => s.nid !== snap.nid);
    list.unshift(snap);
    localStorage.setItem(SNAP_KEY, JSON.stringify(list.slice(0, SNAP_MAX)));
  } catch (e) { /* storage unavailable — feature quietly off */ }
}

// ── Block model ───────────────────────────────────────────────────────────────
function createBlock(type, lang) {
  return { id: nextId++, type, lang: lang || null, content: '' };
}

function buildGutter() {
  const gutter = document.createElement('div');
  gutter.className = 'gutter';
  gutter.innerHTML = `
    <button data-act="add" title="add block below">+</button>
    <button data-act="up" title="move up">↑</button>
    <button data-act="down" title="move down">↓</button>
    <button data-act="del" title="delete block">✕</button>`;
  return gutter;
}

function buildTouchTools(isCode) {
  const tools = document.createElement('div');
  tools.className = 'touch-tools';
  tools.innerHTML = `
    <button data-act="up" title="move up">↑</button>
    <button data-act="down" title="move down">↓</button>
    <button data-act="add" title="add block">＋</button>
    ${isCode ? '<button data-act="copy" title="copy code">⧉</button>' : ''}
    <button data-act="del" title="delete">✕</button>`;
  return tools;
}

function buildBlockEl(block) {
  const div = document.createElement('div');
  div.className = `block ${block.type}-block`;
  div.dataset.id = block.id;

  div.appendChild(buildGutter());
  div.appendChild(buildTouchTools(block.type === 'code'));

  if (block.type === 'code') {
    const head = document.createElement('div');
    head.className = 'code-head';
    head.innerHTML = `
      <button class="lang-badge">${block.lang} <span class="caret">▾</span></button>
      <span class="line-count"></span>
      <span class="head-actions"><button data-act="copy">copy</button></span>`;
    div.appendChild(head);

    const body = document.createElement('div');
    body.className = 'code-body';
    const pre  = document.createElement('pre');
    pre.className = 'hljs-layer';
    const code = document.createElement('code');
    pre.appendChild(code);
    body.appendChild(pre);

    const content = document.createElement('div');
    content.className = 'block-content';
    content.contentEditable = 'true';
    content.spellcheck = false;
    content.autocorrect = 'off';
    content.autocapitalize = 'off';
    if (block.content) content.innerText = block.content;
    body.appendChild(content);
    div.appendChild(body);
    return div;
  }

  const content = document.createElement('div');
  content.className = 'block-content';
  content.contentEditable = 'true';
  content.spellcheck = false;
  content.autocorrect = 'off';
  content.autocapitalize = 'off';
  if (block.content) content.innerText = block.content;
  div.appendChild(content);

  const mdLayer = document.createElement('div');
  mdLayer.className = 'md-layer';
  div.appendChild(mdLayer);

  return div;
}

function getBlockEl(id) {
  return docContainer.querySelector(`[data-id="${id}"]`);
}

function getContentEl(id) {
  return getBlockEl(id)?.querySelector('.block-content');
}

function getBlockIdFromEl(el) {
  const block = el.closest('.block');
  return block ? Number(block.dataset.id) : null;
}

function getBlockData(id) {
  return blocks.find(b => b.id === id);
}

function getBlockText(b) {
  const el = getBlockEl(b.id)?.querySelector('.block-content');
  // innerText of a hidden element (text block showing its markdown layer)
  // drops newlines, so only trust the DOM while the block is visible.
  if (el && el.offsetParent !== null) return el.innerText || '';
  return b.content;
}

function renderAllBlocks() {
  docContainer.innerHTML = '';
  blocks.forEach(b => {
    const el = buildBlockEl(b);
    docContainer.appendChild(el);
    if (b.type === 'code') {
      syncHighlight(b.id);
      updateLineCount(b.id);
    } else {
      syncMarkdown(b.id);
    }
  });
}

function syncHighlight(blockId) {
  const block = getBlockData(blockId);
  if (!block || block.type !== 'code') return;
  const el = getBlockEl(blockId);
  if (!el) return;
  const content = el.querySelector('.block-content');
  const code    = el.querySelector('.hljs-layer code');
  if (!content || !code) return;
  const text = content.innerText || '';
  const lang = block.lang === 'text' ? 'plaintext' : block.lang;
  try {
    code.innerHTML = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
  } catch (e) {
    code.textContent = text;
  }
}

function updateLineCount(blockId) {
  const el = getBlockEl(blockId);
  if (!el) return;
  const counter = el.querySelector('.line-count');
  if (!counter) return;
  const text = el.querySelector('.block-content')?.innerText || '';
  const n = text.trim() ? text.split('\n').length : 0;
  counter.textContent = n ? `${n} ln` : '';
}

function syncMarkdown(blockId) {
  const block = getBlockData(blockId);
  if (!block || block.type !== 'text') return;
  const el = getBlockEl(blockId);
  if (!el) return;
  const text = getBlockText(block);
  const html = renderMarkdown(text);
  const layer = el.querySelector('.md-layer');
  if (!layer) return;
  layer.innerHTML = html;
  el.classList.toggle('has-md', !!html);
}

function focusBlock(id, atEnd) {
  activeBlockId = id;
  const blockEl = getBlockEl(id);
  const content = getContentEl(id);
  if (!content) return;
  // Reveal the editable layer first — focus() on a display:none element is a no-op
  docContainer.querySelectorAll('.block.active, .block.editing').forEach(el => {
    if (el !== blockEl) el.classList.remove('active', 'editing');
  });
  blockEl.classList.add('active', 'editing');
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

function moveBlock(id, dir) {
  const idx = blocks.findIndex(b => b.id === id);
  const newIdx = idx + dir;
  if (idx === -1 || newIdx < 0 || newIdx >= blocks.length) return;
  const swapId = blocks[newIdx].id;
  [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
  const currentEl = getBlockEl(id);
  const swapEl    = getBlockEl(swapId);
  if (dir === -1) {
    docContainer.insertBefore(currentEl, swapEl);
  } else {
    docContainer.insertBefore(swapEl, currentEl);
  }
  scheduleSync();
  updateStatus();
}

function deleteBlock(id) {
  if (blocks.length <= 1) return;
  const idx = blocks.findIndex(b => b.id === id);
  if (idx === -1) return;
  const target = blocks[idx - 1] || blocks[idx + 1];
  blocks.splice(idx, 1);
  getBlockEl(id)?.remove();
  focusBlock(target.id, idx > 0);
  scheduleSync();
}

// Convert an existing (empty text) block into a code block in place.
function convertToCode(id, lang) {
  const idx = blocks.findIndex(b => b.id === id);
  if (idx === -1) return;
  const block = blocks[idx];
  block.type = 'code';
  block.lang = lang;
  block.content = '';
  const oldEl = getBlockEl(id);
  const newEl = buildBlockEl(block);
  oldEl.replaceWith(newEl);
  syncHighlight(id);
  updateLineCount(id);
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
  blocks.filter(b => b.type === 'code').forEach(b => syncHighlight(b.id));
}

function applyFont(font) {
  currentFont = font;
  document.body.style.fontFamily = FONT_CSS[font];
}

// ── Command palette ───────────────────────────────────────────────────────────
function buildCommandList() {
  return [
    { id: 'box',    label: '/box',    ico: '▣',  desc: 'insert code block' },
    { id: 'share',  label: '/share',  ico: '⎘',  desc: 'link · qr · capacity', kbd: '⌘⇧C' },
    { id: 'focus',  label: '/focus',  ico: '◎',  desc: focusMode ? 'exit focus mode' : 'distraction-free writing', kbd: '⌘.' },
    { id: 'theme',  label: '/theme',  ico: '◐',  desc: 'change theme' },
    { id: 'font',   label: '/font',   ico: 'Aa', desc: 'change font' },
    { id: 'export', label: '/export', ico: '⇩',  desc: 'md · pdf · docx · html' },
    { id: 'delete', label: '/delete', ico: '✕',  desc: 'delete current block' },
    { id: 'newNote', label: '/newNote', ico: '✚', desc: 'start a fresh note' },
    { id: 'saveBeforeNew', label: '/save_before_new', ico: '⋯', desc: 'save before new note', hint: saveBeforeNew ? 'on' : 'off' },
  ];
}

function buildInsertList() {
  return [
    { id: 'code',      label: 'code block', ico: '▣', desc: 'python, sql, js...' },
    { id: 'checklist', label: 'checklist',  ico: '☑', desc: '- [ ] todo' },
    { id: 'heading',   label: 'heading',    ico: '#', desc: '# title' },
    { id: 'divider',   label: 'divider',    ico: '—', desc: '---' },
    { id: 'commands',  label: 'all commands...', ico: '⌘' },
  ];
}

let paletteItems    = [];
let paletteFiltered = [];

function openPalette(mode, opts = {}) {
  paletteMode  = mode;
  paletteIndex = 0;
  paletteOpen  = true;
  if (opts.anchor !== undefined) paletteAnchor = opts.anchor;

  if (mode === 'command') {
    paletteAnchor = null;
    paletteTitle.textContent = 'Commands';
    paletteItems = buildCommandList();
  } else if (mode === 'insert') {
    paletteTitle.textContent = 'Insert';
    paletteItems = buildInsertList();
  } else if (mode === 'lang' || mode === 'changeLang') {
    paletteTitle.textContent = 'Language';
    paletteItems = LANGS.map(l => ({ id: l, label: l }));
  } else if (mode === 'font') {
    paletteTitle.textContent = 'Font';
    paletteItems = FONTS.map(f => ({ id: f, label: FONT_LABELS[f], current: f === currentFont }));
  } else if (mode === 'theme') {
    paletteTitle.textContent = 'Theme';
    paletteItems = THEMES.map(t => ({ id: t, label: t, ico: '◐', current: t === currentTheme }));
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

  paletteSearch.value       = '';
  paletteSearch.placeholder = mode === 'filename' ? 'enter filename...' : 'search...';
  renderPaletteList(paletteItems);
  paletteOverlay.classList.remove('hidden');
  positionPalette();
  paletteSearch.focus();
  updateStatus();
}

function positionPalette() {
  if (paletteAnchor && window.innerWidth > 700) {
    paletteEl.classList.add('anchored');
    const rect = paletteEl.getBoundingClientRect();
    const w = rect.width || 340;
    const h = rect.height || 260;
    let x = Math.min(paletteAnchor.x, window.innerWidth - w - 12);
    let y = paletteAnchor.y + 8;
    if (y + h > window.innerHeight - 44) y = Math.max(12, paletteAnchor.y - h - 12);
    paletteEl.style.left = `${Math.max(12, x)}px`;
    paletteEl.style.top  = `${y}px`;
  } else {
    paletteEl.classList.remove('anchored');
    paletteEl.style.left = '';
    paletteEl.style.top  = '';
  }
}

function renderPaletteList(items) {
  paletteFiltered = items;
  paletteIndex = Math.min(paletteIndex, Math.max(0, items.length - 1));
  paletteList.innerHTML = '';
  items.forEach((item, i) => {
    const li = document.createElement('li');

    const ico = document.createElement('span');
    ico.className = 'cmd-ico';
    ico.textContent = item.ico || '·';
    li.appendChild(ico);

    const name = document.createElement('span');
    name.className = 'cmd-name';
    name.textContent = item.label;
    li.appendChild(name);

    if (item.desc) {
      const desc = document.createElement('span');
      desc.className = 'cmd-desc';
      desc.textContent = item.desc;
      li.appendChild(desc);
    }

    const right = document.createElement('span');
    right.className = 'right';
    if (item.current) {
      const tag = document.createElement('span');
      tag.className = 'tag-current';
      tag.textContent = 'current';
      right.appendChild(tag);
    }
    if (item.hint) {
      const hint = document.createElement('span');
      hint.className = 'cmd-desc';
      hint.textContent = item.hint;
      right.appendChild(hint);
    }
    if (item.kbd) {
      const kbd = document.createElement('kbd');
      kbd.textContent = item.kbd;
      right.appendChild(kbd);
    }
    if (right.childNodes.length) li.appendChild(right);

    li.addEventListener('mousedown', (e) => { e.preventDefault(); paletteIndex = i; confirmPalette(); });
    paletteList.appendChild(li);
  });
  updatePaletteHighlight();
  positionPalette();
}

function filterPalette(query) {
  const q = query.toLowerCase().replace(/^\//, '');
  const filtered = q
    ? paletteItems.filter(item =>
        item.label.toLowerCase().includes(q) ||
        (item.desc || '').toLowerCase().includes(q) ||
        (item.hint || '').toLowerCase().includes(q)
      )
    : paletteItems;
  paletteIndex = 0;
  renderPaletteList(filtered);
}

function closePalette() {
  paletteOpen = false;
  paletteMode = null;
  paletteAnchor = null;
  changeLangTarget = null;
  paletteOverlay.classList.add('hidden');
  paletteEl.classList.remove('anchored');
  if (activeBlockId !== null) getContentEl(activeBlockId)?.focus();
  updateStatus();
}

function updatePaletteHighlight() {
  Array.from(paletteList.children).forEach((li, i) => {
    li.classList.toggle('active', i === paletteIndex);
  });
}

function insertSnippet(snippet) {
  closePalette();
  const content = activeBlockId !== null ? getContentEl(activeBlockId) : null;
  if (!content) return;
  content.focus();
  document.execCommand('insertText', false, snippet);
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
    if (selected.id === 'box') { openPalette('lang'); return; }
    if (selected.id === 'share') { closePalette(); openShare(); return; }
    if (selected.id === 'focus') { closePalette(); toggleFocus(); return; }
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
      deleteBlock(activeBlockId);
      return;
    }
    openPalette(selected.id);
    return;
  }

  if (paletteMode === 'insert') {
    if (selected.id === 'code')      { openPalette('lang', { anchor: paletteAnchor }); return; }
    if (selected.id === 'checklist') { insertSnippet('- [ ] '); return; }
    if (selected.id === 'heading')   { insertSnippet('# '); return; }
    if (selected.id === 'commands')  { openPalette('command'); return; }
    if (selected.id === 'divider') {
      closePalette();
      const content = activeBlockId !== null ? getContentEl(activeBlockId) : null;
      if (content) {
        content.innerText = '---';
        syncMarkdown(activeBlockId);
        const newText = createBlock('text');
        insertBlockAfter(activeBlockId, newText);
        focusBlock(newText.id, false);
        scheduleSync();
      }
      return;
    }
    return;
  }

  if (paletteMode === 'lang') {
    const lang = selected.id;
    const active = getBlockData(activeBlockId);
    closePalette();
    if (active && active.type === 'text' && !(getBlockText(active) || '').trim()) {
      // Empty text block → become the code block instead of leaving a stub behind
      convertToCode(active.id, lang);
      focusBlock(active.id, false);
    } else {
      const newBlock = createBlock('code', lang);
      insertBlockAfter(activeBlockId, newBlock);
      focusBlock(newBlock.id, false);
    }
    scheduleSync();
  } else if (paletteMode === 'changeLang') {
    const block = getBlockData(changeLangTarget);
    if (block && block.type === 'code') {
      block.lang = selected.id;
      const badge = getBlockEl(block.id)?.querySelector('.lang-badge');
      if (badge) badge.innerHTML = `${block.lang} <span class="caret">▾</span>`;
      syncHighlight(block.id);
      scheduleSync();
    }
    closePalette();
  } else if (paletteMode === 'font') {
    applyFont(selected.id);
    closePalette();
    scheduleSync();
  } else if (paletteMode === 'theme') {
    applyTheme(selected.id);
    closePalette();
    scheduleSync();
  } else if (paletteMode === 'export') {
    pendingExport = selected.id;
    openPalette('filename');
  }
  updateStatus();
}

// ── URL state, sync & status ──────────────────────────────────────────────────
function collectState() {
  blocks.forEach(b => { b.content = getBlockText(b); });
  return {
    nid: noteId,
    blocks: blocks.map(b => ({ type: b.type, content: b.content, lang: b.lang })),
    font:  currentFont,
    theme: currentTheme,
  };
}

function buildShareUrl() {
  return window.location.origin + window.location.pathname + '#' + encodeState(collectState());
}

function hasContent() {
  return blocks.length > 1 ||
         blocks.some(b => b.type === 'code') ||
         blocks.some(b => (getBlockText(b) || '').trim() !== '');
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, SYNC_DELAY);
}

function syncNow() {
  clearTimeout(syncTimer);
  const state = collectState();
  if (hasContent()) {
    const hash = encodeState(state);
    history.replaceState(null, '', window.location.pathname + '#' + hash);
    lastUrlLen = (window.location.origin + window.location.pathname + '#' + hash).length;
    const langs = [...new Set(state.blocks.filter(b => b.lang).map(b => b.lang))];
    saveSnapshot({
      nid: noteId,
      hash,
      title: noteTitle(state.blocks),
      blockCount: state.blocks.length,
      langs,
      t: Date.now(),
    });
  } else {
    history.replaceState(null, '', window.location.pathname);
    lastUrlLen = 0;
  }
  updateCapacityUI();
}

function updateCapacityUI() {
  const { ratio, level } = capacityLevel(lastUrlLen);
  statusUrlFill.style.width = `${Math.max(ratio * 100, lastUrlLen ? 4 : 0)}%`;
  statusUrlText.textContent = `${(lastUrlLen / 1000).toFixed(1)}k`;
  statusUrl.classList.toggle('amber', level === 'amber');
  statusUrl.classList.toggle('red', level === 'red');
}

function currentMode() {
  if (focusMode)   return 'focus';
  if (paletteOpen) return 'commands';
  if (shareOpen)   return 'share';
  return hasContent() ? 'editing' : 'ready';
}

function updateStatus() {
  statusMode.textContent = currentMode();
  const idx = blocks.findIndex(b => b.id === activeBlockId);
  const active = idx !== -1 ? blocks[idx] : null;
  const kind = active ? (active.type === 'code' ? active.lang : 'text') : 'text';
  statusLang.textContent = active ? `${idx + 1}/${blocks.length} · ${kind}` : `${blocks.length} blocks`;
  statusFont.textContent = FONT_LABELS[currentFont].toLowerCase();
}

function flashCopied(msg) {
  statusCopied.textContent = msg;
  statusCopied.classList.add('visible');
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => statusCopied.classList.remove('visible'), 1500);
}

function copyShareLink() {
  const url = buildShareUrl();
  navigator.clipboard.writeText(url).then(() => flashCopied('link copied ✓'));
}

// ── Share panel ───────────────────────────────────────────────────────────────
function openShare() {
  syncNow();
  const url = buildShareUrl();
  shareOpen = true;

  const hashIdx = url.indexOf('#');
  shareLinkEl.innerHTML =
    `${escapeHtml(url.slice(0, hashIdx + 1))}<span class="hl">${escapeHtml(url.slice(hashIdx + 1, hashIdx + 220))}</span>`;

  shareQr.innerHTML = '';
  if (typeof QRCode !== 'undefined' && url.length <= QR_MAX_CHARS) {
    new QRCode(shareQr, { text: url, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.L });
  } else {
    const msg = document.createElement('div');
    msg.className = 'qr-too-big';
    msg.textContent = url.length > QR_MAX_CHARS
      ? 'note too large for a QR code — copy the link instead'
      : 'qr unavailable';
    shareQr.appendChild(msg);
  }

  const { ratio, level } = capacityLevel(url.length);
  capFill.style.width = `${Math.max(ratio * 100, 3)}%`;
  capText.textContent = `${(url.length / 1000).toFixed(1)}k / ${URL_SAFE_LIMIT / 1000}k safe limit`;
  shareCard.classList.toggle('amber', level === 'amber');
  shareCard.classList.toggle('red', level === 'red');

  shareOverlay.classList.remove('hidden');
  updateStatus();
}

function closeShare() {
  shareOpen = false;
  shareOverlay.classList.add('hidden');
  if (activeBlockId !== null) getContentEl(activeBlockId)?.focus();
  updateStatus();
}

// ── Focus mode ────────────────────────────────────────────────────────────────
function toggleFocus() {
  focusMode = !focusMode;
  document.body.classList.toggle('focus-mode', focusMode);
  if (focusMode) centerActiveBlock();
  updateStatus();
}

function centerActiveBlock() {
  if (activeBlockId === null) return;
  getBlockEl(activeBlockId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// ── Empty state ───────────────────────────────────────────────────────────────
const EXAMPLE_STATE = {
  nid: 'example',
  font: 'jetbrains-mono',
  theme: 'monokai',
  blocks: [
    { type: 'text', lang: null, content: '# Welcome to byebyenotes\n\nThis whole note — text, code, theme — lives **entirely in this URL**. No account, no server: the link *is* the save button.' },
    { type: 'text', lang: null, content: '## Try it\n\n- type `/` in an empty block to insert things\n- [x] open the example\n- [ ] press ⌘⇧C to see the share panel\n- [ ] run `/focus` for distraction-free writing' },
    { type: 'code', lang: 'python', content: 'def bsearch(a, x):\n    lo, hi = 0, len(a) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if a[mid] == x:\n            return mid\n        if a[mid] < x:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1' },
    { type: 'text', lang: null, content: '---\n\nEdit anything, then check your address bar — the URL already changed.' },
  ],
};

function maybeShowEmptyState() {
  const fresh = !window.location.hash && !hasContent();
  if (fresh) {
    renderRecent();
    emptyState.classList.remove('hidden', 'dissolving');
    emptyVisible = true;
  } else {
    emptyState.classList.add('hidden');
    emptyVisible = false;
  }
}

function dissolveEmptyState() {
  if (!emptyVisible) return;
  emptyVisible = false;
  emptyState.classList.add('dissolving');
  setTimeout(() => emptyState.classList.add('hidden'), 380);
}

function renderRecent() {
  const snaps = loadSnapshots();
  recentList.innerHTML = '';
  if (!snaps.length) {
    recentSection.classList.add('hidden');
    return;
  }
  recentSection.classList.remove('hidden');
  snaps.slice(0, 4).forEach(s => {
    const item = document.createElement('div');
    item.className = 'recent-item';
    const langs = (s.langs || []).length
      ? ` · <b>${escapeHtml(s.langs.join(', '))}</b>`
      : '';
    item.innerHTML = `
      <span class="ri-ico">▸</span>
      <span class="ri-name">${escapeHtml(s.title || 'untitled')}</span>
      <span class="ri-langs">${s.blockCount} block${s.blockCount === 1 ? '' : 's'}${langs}</span>
      <span class="ri-time">${timeAgo(s.t)}</span>`;
    item.addEventListener('click', () => {
      dissolveEmptyState();
      window.location.hash = s.hash;
    });
    recentList.appendChild(item);
  });
}

// ── Export ────────────────────────────────────────────────────────────────────
function markdownString() {
  return blocks.map(b => {
    const text = getBlockText(b);
    return b.type === 'code'
      ? '```' + (b.lang || '') + '\n' + text + '\n```'
      : text;
  }).join('\n\n');
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
  downloadBlob(new Blob([markdownString()], { type: 'text/markdown' }), filename + '.md');
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
  const hash    = encodeState(collectState());
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
  noteId = Math.random().toString(36).slice(2, 10);
  blocks = [createBlock('text')];
  renderAllBlocks();
  history.replaceState(null, '', window.location.pathname);
  lastUrlLen = 0;
  updateCapacityUI();
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

function caretPoint(fallbackEl) {
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (r && (r.top || r.left || r.width || r.height)) return { x: r.left, y: r.bottom };
  }
  if (fallbackEl) {
    const r = fallbackEl.getBoundingClientRect();
    return { x: r.left + 14, y: r.top + 28 };
  }
  return null;
}

function handleBlockAction(act, blockId) {
  const block = getBlockData(blockId);
  if (!block) return;
  if (act === 'up')   moveBlock(blockId, -1);
  if (act === 'down') moveBlock(blockId, 1);
  if (act === 'del')  deleteBlock(blockId);
  if (act === 'add') {
    const newBlock = createBlock('text');
    insertBlockAfter(blockId, newBlock);
    focusBlock(newBlock.id, false);
    scheduleSync();
  }
  if (act === 'copy') {
    navigator.clipboard.writeText(getBlockText(block)).then(() => flashCopied('block copied ✓'));
  }
}

function attachEvents() {

  // ── Global shortcuts ──
  document.addEventListener('keydown', (e) => {
    // Esc — close share, else exit focus mode (palette handles its own esc)
    if (e.key === 'Escape' && !paletteOpen) {
      if (shareOpen) { e.preventDefault(); closeShare(); return; }
      if (focusMode) { e.preventDefault(); toggleFocus(); return; }
    }

    if (shareOpen || paletteOpen) return;

    // Ctrl/Cmd+Shift+C — copy link + open share panel
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      copyShareLink();
      openShare();
      return;
    }

    // Ctrl/Cmd+K — command palette from anywhere
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      openPalette('command');
      return;
    }

    // Ctrl/Cmd+. — toggle focus mode
    if ((e.ctrlKey || e.metaKey) && e.key === '.') {
      e.preventDefault();
      toggleFocus();
      return;
    }

    // / with no block focused — command palette
    if (e.key === '/' && !e.target.closest('.block-content') && e.target !== paletteSearch) {
      e.preventDefault();
      openPalette('command');
    }
  });

  // ── Palette ──
  paletteSearch.addEventListener('input', () => {
    filterPalette(paletteSearch.value);
  });

  paletteSearch.addEventListener('keydown', (e) => {
    const count = paletteFiltered.length;
    if (e.key === 'ArrowDown' && count) {
      e.preventDefault();
      paletteIndex = (paletteIndex + 1) % count;
      updatePaletteHighlight();
    } else if (e.key === 'ArrowUp' && count) {
      e.preventDefault();
      paletteIndex = (paletteIndex - 1 + count) % count;
      updatePaletteHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      confirmPalette();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (paletteMode === 'command' || paletteMode === 'insert') {
        closePalette();
      } else if (paletteMode === 'lang' && paletteAnchor) {
        openPalette('insert', { anchor: paletteAnchor });
      } else {
        openPalette('command');
      }
    }
  });

  paletteOverlay.addEventListener('click', (e) => {
    if (e.target === paletteOverlay) closePalette();
  });

  // ── Share panel ──
  shareOverlay.addEventListener('click', (e) => {
    if (e.target === shareOverlay || e.target.closest('.share-head .esc')) closeShare();
  });
  document.getElementById('share-copy').addEventListener('click', (e) => {
    navigator.clipboard.writeText(buildShareUrl()).then(() => {
      e.target.textContent = 'copied ✓';
      setTimeout(() => { e.target.textContent = 'copy link'; }, 1200);
    });
  });
  document.getElementById('share-copy-md').addEventListener('click', (e) => {
    navigator.clipboard.writeText(markdownString()).then(() => {
      e.target.textContent = 'copied ✓';
      setTimeout(() => { e.target.textContent = 'copy markdown'; }, 1200);
    });
  });
  statusUrl.addEventListener('click', () => { if (!shareOpen) openShare(); });

  // ── FAB ──
  fab.addEventListener('click', () => {
    if (paletteOpen) closePalette();
    else openPalette('command');
  });

  // ── Empty state ──
  emptyState.addEventListener('click', (e) => {
    const card = e.target.closest('.hint-card');
    if (card) {
      const hint = card.dataset.hint;
      if (hint === 'palette') { openPalette('command'); return; }
      if (hint === 'box')     { focusBlock(blocks[0].id, false); openPalette('lang'); return; }
      if (hint === 'share')   { openShare(); return; }
      if (hint === 'focus')   { dissolveEmptyState(); focusBlock(blocks[0].id, false); toggleFocus(); return; }
    }
    if (e.target.closest('#example-link') || e.target.closest('.recent-item')) return;
    focusBlock(blocks[0].id, false);
  });

  exampleLink.addEventListener('click', () => dissolveEmptyState());

  // ── URL navigation (example link, recent notes, pasted links) ──
  window.addEventListener('hashchange', () => {
    loadState();
    maybeShowEmptyState();
  });

  // ── Block-level events (delegated from docContainer) ──
  docContainer.addEventListener('focusin', (e) => {
    const content = e.target.closest('.block-content');
    if (!content) return;
    activeBlockId = getBlockIdFromEl(content);
    docContainer.querySelectorAll('.block.active, .block.editing').forEach(el => el.classList.remove('active', 'editing'));
    content.closest('.block')?.classList.add('active', 'editing');
    if (focusMode) centerActiveBlock();
    updateStatus();
  });

  docContainer.addEventListener('focusout', (e) => {
    const content = e.target.closest('.block-content');
    if (!content) return;
    const id = getBlockIdFromEl(content);
    const block = getBlockData(id);
    if (block) block.content = content.innerText || '';   // capture while still visible
    content.closest('.block')?.classList.remove('editing');
    if (block?.type === 'text') syncMarkdown(id);
  });

  docContainer.addEventListener('mousedown', (e) => {
    // Keep focus in the editor when clicking block controls
    if (e.target.closest('.gutter') || e.target.closest('.touch-tools') || e.target.closest('.code-head')) {
      e.preventDefault();
    }
  });

  docContainer.addEventListener('click', (e) => {
    const actBtn = e.target.closest('.gutter button, .touch-tools button, .head-actions button');
    if (actBtn) {
      handleBlockAction(actBtn.dataset.act, getBlockIdFromEl(actBtn));
      return;
    }

    const badge = e.target.closest('.lang-badge');
    if (badge) {
      changeLangTarget = getBlockIdFromEl(badge);
      openPalette('changeLang');
      return;
    }

    const cb = e.target.closest('.md-check .cb');
    if (cb) {
      const id = getBlockIdFromEl(cb);
      const block = getBlockData(id);
      const lineIdx = Number(cb.closest('.md-check').dataset.line);
      block.content = toggleCheckboxLine(getBlockText(block), lineIdx);
      getContentEl(id).innerText = block.content;
      syncMarkdown(id);
      scheduleSync();
      return;
    }

    const layer = e.target.closest('.md-layer');
    if (layer) {
      focusBlock(getBlockIdFromEl(layer), true);
    }
  });

  docContainer.addEventListener('keydown', (e) => {
    if (paletteOpen) return;
    const content = e.target.closest('.block-content');
    if (!content) return;
    const blockId   = getBlockIdFromEl(content);
    const blockData = getBlockData(blockId);
    const blockIdx  = blocks.findIndex(b => b.id === blockId);

    // Ctrl/Cmd+Shift+↑/↓ — reorder block
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moveBlock(blockId, e.key === 'ArrowUp' ? -1 : 1);
      return;
    }

    // / in an empty block — insert palette at the caret; otherwise / just types
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if ((content.innerText || '').trim() === '') {
        e.preventDefault();
        openPalette('insert', { anchor: caretPoint(content) });
        return;
      }
      // fall through: literal slash (finally typeable in code!)
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

    // Shift+Enter — exit block (works in text and code blocks alike)
    if (e.key === 'Enter' && e.shiftKey) {
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
        deleteBlock(blockId);
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
    const block = getBlockData(blockId);
    if (block) block.content = content.innerText || '';
    if (block?.type === 'code') {
      syncHighlight(blockId);
      updateLineCount(blockId);
    }
    dissolveEmptyState();
    if (focusMode) centerActiveBlock();
    scheduleSync();
    updateStatus();
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
function loadState() {
  const hash  = window.location.hash.slice(1);
  const state = decodeState(hash);

  if (state && Array.isArray(state.blocks) && state.blocks.length > 0) {
    currentFont  = FONTS.includes(state.font)   ? state.font  : 'jetbrains-mono';
    currentTheme = THEMES.includes(state.theme) ? state.theme : 'monokai';
    noteId = typeof state.nid === 'string' ? state.nid : Math.random().toString(36).slice(2, 10);
    nextId = 0;
    blocks = state.blocks.map(b => {
      const block = createBlock(b.type, b.lang);
      block.content = b.content || '';
      return block;
    });
    lastUrlLen = (window.location.origin + window.location.pathname + '#' + hash).length;
  } else {
    noteId = Math.random().toString(36).slice(2, 10);
    blocks = [createBlock('text')];
    lastUrlLen = 0;
  }

  applyFont(currentFont);
  applyTheme(currentTheme);
  renderAllBlocks();
  updateCapacityUI();

  if (blocks.length > 0) focusBlock(blocks[0].id, false);
  updateStatus();
}

document.addEventListener('DOMContentLoaded', () => {
  docContainer   = document.getElementById('document-container');
  statusMode     = document.getElementById('status-mode');
  statusLang     = document.getElementById('status-lang');
  statusFont     = document.getElementById('status-font');
  statusUrl      = document.getElementById('status-url');
  statusUrlFill  = document.getElementById('status-url-fill');
  statusUrlText  = document.getElementById('status-url-text');
  statusHint     = document.getElementById('status-hint');
  statusCopied   = document.getElementById('status-copied');
  paletteOverlay = document.getElementById('palette-overlay');
  paletteEl      = document.getElementById('palette');
  paletteSearch  = document.getElementById('palette-search');
  paletteTitle   = document.getElementById('palette-title');
  paletteList    = document.getElementById('palette-list');
  emptyState     = document.getElementById('empty-state');
  recentSection  = document.getElementById('recent-section');
  recentList     = document.getElementById('recent-list');
  exampleLink    = document.getElementById('example-link');
  shareOverlay   = document.getElementById('share-overlay');
  shareCard      = document.getElementById('share-card');
  shareLinkEl    = document.getElementById('share-link');
  shareQr        = document.getElementById('share-qr');
  capFill        = document.getElementById('cap-fill');
  capText        = document.getElementById('cap-text');
  fab            = document.getElementById('fab');

  statusHint.textContent = '/ insert · ⌘K commands · ⌘⇧C share · ⌘. focus';
  exampleLink.href = '#' + encodeState(EXAMPLE_STATE);

  loadState();
  maybeShowEmptyState();
  attachEvents();
  updateStatus();
});

// ── Export for tests (no-op in browser) ──────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = {
    encodeState, decodeState, createBlock, buildBlockEl,
    renderMarkdown, escapeHtml, toggleCheckboxLine, noteTitle,
    capacityLevel, timeAgo,
  };
}
