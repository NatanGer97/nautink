import { describe, expect, it } from 'vitest';

import { findFreeSpot, overlaps } from './geometry.ts';

describe('overlaps', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };

  it('detects overlap and near misses within the gap', () => {
    expect(overlaps(a, { x: 5, y: 5, w: 10, h: 10 }, 0)).toBe(true);
    expect(overlaps(a, { x: 15, y: 0, w: 10, h: 10 }, 6)).toBe(true);
    expect(overlaps(a, { x: 15, y: 0, w: 10, h: 10 }, 5)).toBe(false);
  });
});

describe('findFreeSpot', () => {
  const size = { width: 10, height: 10 };

  it('keeps the start when it is free', () => {
    expect(findFreeSpot({ rects: [], size, start: { x: 3, y: 4 }, gap: 0, step: 10 })).toEqual({
      x: 3,
      y: 4,
    });
  });

  it('searches the nearest ring first', () => {
    const rects = [{ x: 0, y: 0, w: 10, h: 10 }];
    expect(findFreeSpot({ rects, size, start: { x: 0, y: 0 }, gap: 0, step: 10 })).toEqual({
      x: -10,
      y: -10,
    });
  });

  it('gives up and returns the start when nothing fits', () => {
    const rects = [{ x: -10_000, y: -10_000, w: 20_000, h: 20_000 }];
    expect(findFreeSpot({ rects, size, start: { x: 1, y: 1 }, gap: 0, step: 1 })).toEqual({
      x: 1,
      y: 1,
    });
  });
});
