import { describe, expect, it } from 'vitest';

import { endShifts, erBoxes, erEdges, erNodes, handlesFor } from './er-elements.ts';
import { markerId } from './er-markers.tsx';
import { NO_SELECTION } from './er-types.ts';
import { sampleModel } from '../../../tests/er-fixtures.ts';

import type { ErModel } from '@nautink/editors/er/model';
import type { Rect } from '@nautink/visual-core/geometry';
import type { PositionMap } from '@nautink/visual-core/positions';

const POSITIONS: PositionMap = {
  CUSTOMER: { x: 0, y: 0 },
  ORDER: { x: 400, y: 0 },
  LINE: { x: 400, y: 300 },
};

describe('erNodes', () => {
  it('draws group frames under the tables, sized around their members', () => {
    const nodes = erNodes(sampleModel(), POSITIONS, {
      ...NO_SELECTION,
      entities: ['ORDER'],
      group: 'SALES',
    });
    expect(nodes.map((node) => [node.id, node.type, node.selected])).toEqual([
      ['SALES', 'subgraph', true],
      ['CUSTOMER', 'entity', false],
      ['ORDER', 'entity', true],
      ['LINE', 'entity', false],
    ]);
    const frame = nodes[0];
    expect(frame?.position).toEqual({ x: 376, y: -46 });
    expect(frame?.draggable).toBe(false);
  });

  it('puts entities without a spot at the origin and skips empty groups', () => {
    const model: ErModel = {
      ...sampleModel(),
      subgraphs: [{ id: 'EMPTY', title: '', members: [], dir: '', classes: [] }],
    };
    const nodes = erNodes(model, {}, NO_SELECTION);
    expect(nodes.map((node) => node.id)).toEqual(['CUSTOMER', 'ORDER', 'LINE']);
    expect(nodes[0]?.position).toEqual({ x: 0, y: 0 });
  });

  it('nests inner frames above outer ones', () => {
    const model: ErModel = {
      ...sampleModel(),
      subgraphs: [
        { id: 'INNER', title: '', members: ['LINE'], dir: '', classes: [] },
        { id: 'OUTER', title: '', members: ['INNER', 'ORDER'], dir: '', classes: [] },
      ],
    };
    const boxes = erBoxes(model, POSITIONS);
    expect(boxes.get('OUTER')?.y).toBeLessThan(boxes.get('INNER')?.y ?? 0);
    const [inner, outer] = erNodes(model, POSITIONS, NO_SELECTION);
    expect((inner?.zIndex ?? 0) > (outer?.zIndex ?? 0)).toBe(true);
  });
});

describe('handlesFor', () => {
  const box = (x: number, y: number): Rect => ({ x, y, w: 150, h: 60 });

  it('links side by side boxes left to right', () => {
    expect(handlesFor(box(0, 0), box(300, 30))).toEqual(['r', 'l']);
    expect(handlesFor(box(300, 0), box(0, 0))).toEqual(['l', 'r']);
  });

  it('links stacked boxes top to bottom', () => {
    expect(handlesFor(box(0, 0), box(20, 200))).toEqual(['b', 't']);
    expect(handlesFor(box(0, 200), box(0, 0))).toEqual(['t', 'b']);
  });
});

describe('erEdges', () => {
  it('draws each relationship with its crow’s-foot ends, line style and label', () => {
    const edges = erEdges(sampleModel(), POSITIONS, { ...NO_SELECTION, rels: ['R_ORDER_LINE_0'] });
    expect(edges.map((edge) => [edge.id, edge.sourceHandle, edge.targetHandle])).toEqual([
      ['R_CUSTOMER_ORDER_0', 'r', 'l'],
      ['R_ORDER_LINE_0', 'b', 't'],
    ]);
    expect(edges[1]).toMatchObject({
      markerStart: markerId('ONLY_ONE', true),
      markerEnd: markerId('ONE_OR_MORE', true),
      selected: true,
      data: { label: 'contains', isIdentifying: false, isSelf: false },
    });
  });

  it('loops a self relationship from the right side into the top', () => {
    const model: ErModel = {
      ...sampleModel(),
      rels: [{ ...sampleModel().rels[0]!, id: 'R_LINE_LINE_0', from: 'LINE', to: 'LINE' }],
    };
    const [edge] = erEdges(model, POSITIONS, NO_SELECTION);
    expect(edge).toMatchObject({ sourceHandle: 'r', targetHandle: 't', data: { isSelf: true } });
  });

  it('skips relationships whose ends are not on the canvas', () => {
    const model: ErModel = { ...sampleModel(), entities: [], subgraphs: [] };
    expect(erEdges(model, POSITIONS, NO_SELECTION)).toEqual([]);
  });
});

describe('endShifts', () => {
  it('spreads links that share a side, in the order of their other ends', () => {
    const model: ErModel = {
      ...sampleModel(),
      subgraphs: [],
      rels: [
        { ...sampleModel().rels[0]!, id: 'R_CUSTOMER_LINE_0', from: 'CUSTOMER', to: 'LINE' },
        { ...sampleModel().rels[0]!, id: 'R_CUSTOMER_ORDER_0', from: 'CUSTOMER', to: 'ORDER' },
      ],
    };
    const positions: PositionMap = { ...POSITIONS, LINE: { x: 400, y: 60 } };
    const [toLine, toOrder] = erEdges(model, positions, NO_SELECTION);
    expect(toOrder?.data?.sourceShift).toBeLessThan(0);
    expect(toLine?.data?.sourceShift).toBeGreaterThan(0);
    expect(toOrder?.data?.targetShift).toBe(0);
  });

  it('gives nothing to a lone end', () => {
    expect(endShifts([], new Map())).toEqual(new Map());
  });
});
