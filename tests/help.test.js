// Stubs for globals app.js touches at require time (same as the other suites).
global.LZString = {
  compressToEncodedURIComponent: (s) => btoa(s),
  decompressFromEncodedURIComponent: (s) => { try { return atob(s); } catch (e) { return null; } },
};
global.hljs = { highlight: (text) => ({ value: text }) };

const mod = require('../app.js');

const headings = (list) => list.filter(i => i.heading).map(i => i.heading);
const section = (list, name) => {
  const start = list.findIndex(i => i.heading === name);
  if (start === -1) return [];
  const rest = list.slice(start + 1);
  const end = rest.findIndex(i => i.heading);
  return end === -1 ? rest : rest.slice(0, end);
};

test('buildHelpList opens with an intro row (no heading) that mentions the URL', () => {
  const list = mod.buildHelpList();
  const intro = list[0];
  expect(intro.heading).toBeUndefined();
  expect(`${intro.label} ${intro.desc}`.toLowerCase()).toContain('url');
});

test('buildHelpList has COMMANDS, SHORTCUTS and FORMATTING sections in order', () => {
  expect(headings(mod.buildHelpList())).toEqual(['COMMANDS', 'SHORTCUTS', 'FORMATTING']);
});

test('COMMANDS section lists every command from buildCommandList except help itself', () => {
  const list = mod.buildHelpList();
  const cmdLabels = section(list, 'COMMANDS').map(i => i.label);
  mod.buildCommandList()
    .filter(c => c.id !== 'help')
    .forEach(c => expect(cmdLabels).toContain(c.label));
  expect(cmdLabels).not.toContain('/help'); // help doesn't document itself
});

test('SHORTCUTS section documents the core key bindings', () => {
  const kbds = section(mod.buildHelpList(), 'SHORTCUTS').map(i => i.kbd);
  ['⌘K', '⌘⇧C', '⌘.', '/', 'Enter', '⇧Enter'].forEach(k => expect(kbds).toContain(k));
});

test('FORMATTING section documents markdown syntax', () => {
  const rows = section(mod.buildHelpList(), 'FORMATTING');
  const byLabel = Object.fromEntries(rows.map(r => [r.label, r.desc]));
  expect(byLabel.bold).toContain('**');
  expect(byLabel.italic).toContain('*');
  expect(byLabel.highlight).toContain('==');
  expect(rows.map(r => r.label)).toEqual(
    expect.arrayContaining(['bold', 'italic', 'heading', 'checklist', 'divider'])
  );
});

test('every row is either a heading or has a label', () => {
  mod.buildHelpList().forEach(i => {
    expect(Boolean(i.heading) || Boolean(i.label)).toBe(true);
  });
});
