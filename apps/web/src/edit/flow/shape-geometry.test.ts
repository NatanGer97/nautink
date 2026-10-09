import { SHAPES } from '@nautink/editors/flow/library';
import { nodeSize } from '@nautink/editors/flow/size';
import { describe, expect, it } from 'vitest';

import { drawShape, SHAPE_PARTS, shapeVars } from './shape-geometry.ts';
import { evaluate, fillTemplate } from './shape-template.ts';

describe('shape templates', () => {
  it('evaluates sums of scaled variables and constants', () => {
    const vars = { w: 100, h: 40, s: 10 };
    expect(evaluate('w-s-1', vars)).toBe(89);
    expect(evaluate('0.75w', vars)).toBe(75);
    expect(evaluate('2-w', vars)).toBe(-98);
    expect(evaluate('8.5', vars)).toBe(8.5);
    expect(fillTemplate('M{w-1},{0.5h} L1,1', vars)).toBe('M99,20 L1,1');
  });

  it('names what it cannot read', () => {
    expect(() => evaluate('w*2', { w: 1 })).toThrow('Cannot read the shape template "w*2" at 1');
    expect(() => evaluate('q+1', { w: 1 })).toThrow('Unknown variable "q"');
  });
});

describe('shape geometry', () => {
  it('draws every one of the 53 library shapes, and nothing else', () => {
    expect(SHAPES).toHaveLength(53);
    expect(Object.keys(SHAPE_PARTS).sort()).toEqual(SHAPES.map((shape) => shape.id).sort());
    for (const shape of SHAPES) {
      const { width, height } = nodeSize({ shape: shape.id, label: 'Label' });
      const parts = drawShape(shape.id, width, height);
      expect(parts.length, shape.id).toBeGreaterThan(0);
      for (const part of parts) {
        expect(part.d, shape.id).not.toMatch(/[{}]|NaN|Infinity/);
      }
    }
  });

  it('draws stacked parts in smaller, offset boxes and falls back to a process box', () => {
    expect(drawShape('docs', 100, 60).map(({ dx, dy }) => [dx, dy])).toEqual([
      [8, 0],
      [4, 4],
      [0, 8],
    ]);
    expect(drawShape('person', 80, 80)[1]?.dy).toBe(2 * shapeVars(80, 80).pr! + 4);
    expect(drawShape('no-such-shape', 100, 40)).toEqual(drawShape('rect', 100, 40));
    expect(drawShape('constructor', 100, 40)).toEqual(drawShape('rect', 100, 40));
  });
});
