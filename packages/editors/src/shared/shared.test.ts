import { describe, expect, it } from 'vitest';

import { createLayoutGraph, runLayout, sizeLabel, topLeftOf } from './dagre-graph.ts';
import { hasMethods } from './mermaid-parse.ts';
import { positionOf, rectAt } from './positions.ts';
import { parentMap } from './subgraphs.ts';
import { numberAt, numberOr, numberOrNull, textAt, textOr } from './values.ts';

describe('dagre graph', () => {
  it('lays out a plain graph and reports top-left corners', () => {
    const graph = createLayoutGraph({ graph: { rankdir: 'TB', marginx: 0, marginy: 0 } });
    graph.setNode('a', sizeLabel({ width: 10, height: 20 }));
    runLayout(graph);
    expect(topLeftOf(graph, 'a')).toEqual({ x: 0, y: 0 });
    expect(graph.isCompound()).toBe(false);
  });

  it('treats a node dagre has not placed as centred on the origin', () => {
    const graph = createLayoutGraph({ graph: {}, isCompound: true, isMultigraph: true });
    graph.setNode('a', sizeLabel({ width: 10, height: 20 }));
    expect(topLeftOf(graph, 'a')).toEqual({ x: -5, y: -10 });
    expect(graph.isMultigraph()).toBe(true);
  });
});

describe('hasMethods', () => {
  it('checks that every name is a function', () => {
    expect(hasMethods({ a: () => 1, b: () => 2 }, ['a', 'b'])).toBe(true);
    expect(hasMethods({ a: 1 }, ['a'])).toBe(false);
    expect(hasMethods(null, ['a'])).toBe(false);
    expect(hasMethods('x', [])).toBe(false);
  });
});

describe('positions', () => {
  it('ignores inherited keys', () => {
    expect(positionOf({ a: { x: 1, y: 2 } }, 'a')).toEqual({ x: 1, y: 2 });
    expect(positionOf({}, 'constructor')).toBeUndefined();
  });

  it('builds a rect from a position and size', () => {
    expect(rectAt({ x: 1, y: 2 }, { width: 3, height: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });
});

describe('parentMap', () => {
  it('maps members to their innermost group and skips self-membership', () => {
    const parents = parentMap([
      { id: 'inner', members: ['a', 'inner'] },
      { id: 'outer', members: ['a', 'inner', 'b'] },
    ]);
    expect([...parents]).toEqual([
      ['a', 'inner'],
      ['inner', 'outer'],
      ['b', 'outer'],
    ]);
  });
});

describe('numberOr', () => {
  it('falls back like `||`', () => {
    expect(numberOr(5, 1)).toBe(5);
    expect(numberOr(0, 1)).toBe(1);
    expect(numberOr(Number.NaN, 1)).toBe(1);
    expect(numberOr(null, 1)).toBe(1);
    expect(numberOr(undefined, 1)).toBe(1);
    expect(numberOrNull(0)).toBeNull();
    expect(numberOrNull(3)).toBe(3);
  });
});

describe('list and text fallbacks', () => {
  it('reads past the end as empty', () => {
    expect(textAt(['a'], 0)).toBe('a');
    expect(textAt(['a'], 3)).toBe('');
    expect(numberAt([4], 0)).toBe(4);
    expect(numberAt([], 0)).toBe(0);
    expect(textOr('', 'x')).toBe('x');
    expect(textOr(undefined, 'x')).toBe('x');
    expect(textOr('y', 'x')).toBe('y');
  });
});
