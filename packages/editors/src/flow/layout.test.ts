import { overlaps } from '@nautink/visual-core/geometry';
import { describe, expect, it } from 'vitest';

import { dagreLayout, freeSpot, placeNear, placeNodes, tagLabels } from './layout.ts';
import { emptyModel, parse } from './model.ts';
import { nodeSize } from './size.ts';
import { FLOW_FIXTURES } from '../../tests/fixtures/flow.ts';
import { loadMermaid } from '../../tests/mermaid-loader.ts';

import type { FlowGraph, FlowNode } from './model.ts';
import type { PositionMap } from '@nautink/visual-core/positions';

async function parseOk(code: string): Promise<FlowGraph> {
  const result = await parse(code, loadMermaid);
  if (result.kind !== 'ok') {
    throw new Error(result.message);
  }
  return result.model;
}

function expectNoOverlaps(graph: FlowGraph, positions: PositionMap): void {
  const rects = graph.nodes
    .filter((node) => positions[node.id])
    .map((node) => {
      const size = nodeSize(node);
      return { x: positions[node.id]!.x, y: positions[node.id]!.y, w: size.width, h: size.height };
    });
  rects.forEach((a, i) => {
    rects.slice(i + 1).forEach((b) => {
      expect(overlaps(a, b, 0)).toBe(false);
    });
  });
}

const node = (id: string, label: string = id): FlowNode => ({
  id,
  label,
  shape: 'rect',
  classes: [],
});

describe('dagreLayout', () => {
  it.each(['template', 'subgraphs', 'shapes', 'icons'])(
    'places every node of %s without overlaps',
    async (name) => {
      const graph = await parseOk(FLOW_FIXTURES[name]!);
      const positions = dagreLayout(graph);
      const groups = new Set(graph.subgraphs.map((subgraph) => subgraph.id));
      expect(Object.keys(positions).sort()).toEqual(
        graph.nodes
          .filter((item) => !groups.has(item.id))
          .map((item) => item.id)
          .sort(),
      );
      expectNoOverlaps(graph, positions);
    },
  );

  it('follows the direction', async () => {
    const down = dagreLayout(await parseOk('flowchart TD\n    a --> b\n'));
    const right = dagreLayout(await parseOk('flowchart LR\n    a --> b\n'));
    expect(down.b!.y).toBeGreaterThan(down.a!.y);
    expect(right.b!.x).toBeGreaterThan(right.a!.x);
  });
});

describe('placeNear', () => {
  const positions = { a: { x: 0, y: 0 } };

  it.each([
    ['TD', { x: 0, y: 114 }],
    ['BT', { x: 0, y: -114 }],
    ['LR', { x: 180, y: 0 }],
    ['RL', { x: -180, y: 0 }],
  ] as const)('puts a node next to its anchor in %s', (direction, spot) => {
    const graph = { ...emptyModel(), direction, nodes: [node('a'), node('b')] };
    expect(placeNear({ graph, positions, node: node('b'), anchorId: 'a' })).toEqual(spot);
  });

  it('puts an unlinked node to the right of everything, or at the origin', () => {
    const graph = { ...emptyModel(), nodes: [node('a'), node('b')] };
    expect(placeNear({ graph, positions, node: node('b') })).toEqual({ x: 170, y: 0 });
    expect(placeNear({ graph, positions: {}, node: node('b') })).toEqual({ x: 0, y: 0 });
  });

  it('nudges a node until it overlaps nothing', () => {
    const graph = { ...emptyModel(), nodes: [node('a'), node('b'), node('c')] };
    const crowded = { a: { x: 0, y: 0 }, b: { x: 0, y: 114 } };
    expect(placeNear({ graph, positions: crowded, node: node('c'), anchorId: 'a' })).toEqual({
      x: 114,
      y: 114,
    });
    const sideways = { ...graph, direction: 'LR' as const };
    const row = { a: { x: 0, y: 0 }, b: { x: 180, y: 0 } };
    expect(placeNear({ graph: sideways, positions: row, node: node('c'), anchorId: 'a' })).toEqual({
      x: 180,
      y: 68,
    });
  });
});

describe('freeSpot', () => {
  it('finds the nearest free spot', () => {
    const graph = { ...emptyModel(), nodes: [node('a')] };
    const size = { width: 90, height: 44 };
    expect(freeSpot({ graph, positions: {}, size, start: { x: 5, y: 5 } })).toEqual({ x: 5, y: 5 });
    expect(
      freeSpot({ graph, positions: { a: { x: 0, y: 0 } }, size, start: { x: 0, y: 0 } }),
    ).toEqual({
      x: -60,
      y: -60,
    });
  });
});

describe('tagLabels', () => {
  it('records each placed node label without touching the input', () => {
    const graph = { ...emptyModel(), nodes: [node('a', 'Alpha'), node('b')] };
    const positions = { a: { x: 1, y: 2 } };
    expect(tagLabels(graph, positions)).toEqual({ a: { x: 1, y: 2, l: 'Alpha' } });
    expect(positions).toEqual({ a: { x: 1, y: 2 } });
  });
});

describe('placeNodes', () => {
  it('lays everything out when most nodes are unknown', async () => {
    const graph = await parseOk(FLOW_FIXTURES.template!);
    const result = placeNodes(graph, {});
    expect(result.isFullLayout).toBe(true);
    expect(Object.keys(result.positions)).toHaveLength(6);
    expect(result.positions.start!.l).toBe('Start');
  });

  it('keeps known nodes and places new ones next to a linked neighbour', async () => {
    const graph = await parseOk('flowchart TD\n    a --> b\n    a --> c\n');
    const known = { a: { x: 0, y: 0, l: 'a' }, b: { x: 0, y: 200, l: 'b' }, gone: { x: 9, y: 9 } };
    const result = placeNodes(graph, known);
    expect(result.isFullLayout).toBe(false);
    expect(result.positions.a).toEqual({ x: 0, y: 0, l: 'a' });
    expect(result.positions.c).toEqual({ x: 0, y: 114, l: 'c' });
    expect(result.positions.gone).toEqual({ x: 9, y: 9 });
  });

  it('places a node again when its label changed', async () => {
    const graph = await parseOk('flowchart TD\n    a --> b\n    c --> b\n');
    const stale = {
      a: { x: 0, y: 0, l: 'a' },
      b: { x: 0, y: 200, l: 'b' },
      c: { x: 500, y: 500, l: 'old' },
    };
    expect(placeNodes(graph, stale).positions.c).toEqual({ x: 0, y: 314, l: 'c' });
  });

  it('anchors a new node on a placed node it links to', async () => {
    const graph = await parseOk('flowchart TD\n    a --> b\n    c --> a\n    d\n');
    const known = { a: { x: 0, y: 0, l: 'a' }, b: { x: 0, y: 200, l: 'b' } };
    const result = placeNodes(graph, known).positions;
    expect(result.c).toEqual({ x: 0, y: 114, l: 'c' });
    expect(result.d).toEqual({ x: 170, y: 0, l: 'd' });
  });

  it('handles an empty graph', () => {
    expect(placeNodes(emptyModel(), {})).toEqual({ positions: {}, isFullLayout: false });
  });
});
