import { describe, expect, it, vi } from 'vitest';

import { approximateTextWidth, createCachedMeasurer } from './text-measure.ts';

describe('approximateTextWidth', () => {
  it('counts 7px per character', () => {
    expect(approximateTextWidth('abc')).toBe(21);
  });
});

describe('createCachedMeasurer', () => {
  it('measures each text and font once', () => {
    const measure = vi.fn((text: string) => text.length);
    const cached = createCachedMeasurer(measure);
    expect(cached('ab', '12px a')).toBe(2);
    expect(cached('ab', '12px a')).toBe(2);
    expect(cached('ab', '13px a')).toBe(2);
    expect(measure).toHaveBeenCalledTimes(2);
  });

  it('clears the cache once it is over the limit', () => {
    const measure = vi.fn((text: string) => text.length);
    const cached = createCachedMeasurer(measure, 1);
    cached('a', 'f');
    cached('b', 'f');
    cached('c', 'f');
    cached('a', 'f');
    expect(measure).toHaveBeenCalledTimes(4);
  });
});
