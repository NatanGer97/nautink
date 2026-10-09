import { describe, expect, it } from 'vitest';

import { canvasTextMeasurer, measureText } from './text-measurer.ts';

describe('canvasTextMeasurer', () => {
  it('falls back to v1’s 7 px per character without a canvas (jsdom)', () => {
    expect(measureText('abcd', '13px Geist')).toBe(28);
    expect(canvasTextMeasurer('abc', '13px Geist')).toBe(21);
  });
});
