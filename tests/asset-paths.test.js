/**
 * Guards issue #17: a tiny share link (/s/<id>) is a nested path, so any *relative*
 * local asset reference in index.html (e.g. href="style.css") resolves against /s/
 * — becomes /s/style.css — and the SPA rewrite serves index.html back as text/html.
 * The browser then refuses the CSS/JS by MIME type and the page renders blank.
 *
 * Local (same-origin) asset references must therefore be root-absolute (start with "/")
 * so they load identically from "/" and from "/s/<id>".
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Pull every href="..." and src="..." value out of index.html.
function assetRefs() {
  const refs = [];
  const re = /(?:href|src)\s*=\s*"([^"]*)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) refs.push(m[1]);
  return refs;
}

// A reference is "local" when it points at a file this repo serves — not an absolute
// URL (http:, https:, //cdn), not a data: URI, and not a bare in-page fragment (#...).
function isLocalAsset(ref) {
  return !/^(?:[a-z]+:|\/\/|#|data:)/i.test(ref);
}

describe('index.html asset paths (issue #17: tiny links break on /s/<id>)', () => {
  test('every local asset reference is root-absolute', () => {
    const relative = assetRefs().filter(isLocalAsset).filter(ref => !ref.startsWith('/'));
    expect(relative).toEqual([]);
  });

  test('style.css and app.js are referenced with a leading slash', () => {
    expect(html).toMatch(/href="\/style\.css"/);
    expect(html).toMatch(/src="\/app\.js"/);
  });
});
