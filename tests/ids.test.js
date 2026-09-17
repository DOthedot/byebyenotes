/**
 * @jest-environment node
 *
 * api/ids.js — ids for tiny links and images. Both are served by public GETs, so the
 * id is the only thing between a stranger and the content.
 */
const { randomId } = require('../api/ids');

test('randomId returns exactly the requested length from [a-z0-9]', () => {
  for (const len of [6, 8, 12, 16]) {
    expect(randomId(len)).toMatch(new RegExp(`^[a-z0-9]{${len}}$`));
  }
});

test('randomId does not repeat across many calls', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => randomId(8)));
  expect(ids.size).toBe(1000);
});
