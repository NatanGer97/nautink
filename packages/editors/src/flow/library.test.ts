import { describe, expect, it } from 'vitest';

import { canonicalShape, CATEGORIES, QUICK, SHAPE_BY_ID, SHAPES } from './library.ts';

describe('shape library', () => {
  it('has all 53 Mermaid shapes, each in a known category', () => {
    expect(SHAPES).toHaveLength(53);
    expect(new Set(SHAPES.map((shape) => shape.id)).size).toBe(53);
    for (const shape of SHAPES) {
      expect(CATEGORIES).toContain(shape.cat);
    }
  });

  it('has a toolbar of known shapes', () => {
    for (const id of QUICK) {
      expect(SHAPE_BY_ID.has(id)).toBe(true);
    }
  });
});

describe('canonicalShape', () => {
  it('maps Mermaid names and aliases onto our ids', () => {
    expect(canonicalShape('square')).toBe('rect');
    expect(canonicalShape('lean_right')).toBe('lean-r');
    expect(canonicalShape('rect_left_inv_arrow')).toBe('odd');
    expect(canonicalShape('doublecircle')).toBe('dbl-circ');
  });

  it('keeps our own ids and unknown names, and defaults to rect', () => {
    expect(canonicalShape('cloud')).toBe('cloud');
    expect(canonicalShape('mystery')).toBe('mystery');
    expect(canonicalShape(undefined)).toBe('rect');
    expect(canonicalShape('')).toBe('rect');
  });
});
