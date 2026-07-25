const { nextNavIndex } = require('../app.js');

describe('nextNavIndex', () => {
  test('empty list yields no selection', () => {
    expect(nextNavIndex(-1, 'ArrowDown', 0)).toBe(-1);
    expect(nextNavIndex(2, 'ArrowUp', 0)).toBe(-1);
  });

  test('from no selection, Down picks first and Up picks last', () => {
    expect(nextNavIndex(-1, 'ArrowDown', 3)).toBe(0);
    expect(nextNavIndex(-1, 'ArrowUp', 3)).toBe(2);
  });

  test('Down wraps past the end', () => {
    expect(nextNavIndex(0, 'ArrowDown', 3)).toBe(1);
    expect(nextNavIndex(2, 'ArrowDown', 3)).toBe(0);
  });

  test('Up wraps past the top', () => {
    expect(nextNavIndex(1, 'ArrowUp', 3)).toBe(0);
    expect(nextNavIndex(0, 'ArrowUp', 3)).toBe(2);
  });

  test('unrelated keys leave the index unchanged', () => {
    expect(nextNavIndex(1, 'Enter', 3)).toBe(1);
    expect(nextNavIndex(1, 'a', 3)).toBe(1);
  });
});
