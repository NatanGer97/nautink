import { describe, expect, it } from 'vitest';

import { flowBoxes, flowEdges, flowNodes, handlesFor } from './flow-elements.ts';
import { CIRCLE_MARKER } from './flow-markers.tsx';
import { NO_SELECTION } from './flow-types.ts';
import { sampleGraph } from '../../../tests/flow-fixtures.ts';

const POSITIONS = { A: { x: 0, y: 0 }, B: { x: 0, y: 200 }, C: { x: 300, y: 200 } };

describe('flow elements', () => {
  it('builds group frames under the nodes, with known sizes so nothing waits to be measured', () => {
    const nodes = flowNodes(sampleGraph(), POSITIONS, { nodes: ['A'], edges: [], group: 'G' });
    expect(nodes.map((node) => [node.id, node.type, node.selected])).toEqual([
      ['G', 'subgraph', true],
      ['A', 'shape', true],
      ['B', 'shape', false],
      ['C', 'shape', false],
    ]);
    const frame = nodes[0];
    const box = flowBoxes(sampleGraph(), POSITIONS).get('B');
    expect(frame?.position).toEqual({ x: (box?.x ?? 0) - 22, y: (box?.y ?? 0) - 46 });
    expect(nodes[1]?.measured).toEqual({ width: nodes[1]?.width, height: nodes[1]?.height });
  });

  it('places unplaced nodes at the origin and skips empty groups', () => {
    const graph = { ...sampleGraph(), subgraphs: [{ id: 'E', title: '', members: [], dir: '' }] };
    const nodes = flowNodes(graph, {}, NO_SELECTION);
    expect(nodes.map((node) => node.id)).toEqual(['A', 'B', 'C']);
    expect(nodes[0]?.position).toEqual({ x: 0, y: 0 });
  });

  it('attaches links to the facing sides, with their markers, labels and strokes', () => {
    const edges = flowEdges(sampleGraph(), POSITIONS, { ...NO_SELECTION, edges: ['L_B_C_0'] });
    expect(edges[0]).toMatchObject({ sourceHandle: 'b', targetHandle: 't', selected: false });
    expect(edges[1]).toMatchObject({
      sourceHandle: 'r',
      targetHandle: 'l',
      label: 'yes',
      markerEnd: CIRCLE_MARKER,
      className: 'flow-edge-dotted',
      selected: true,
    });
    expect(handlesFor({ x: 100, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 })).toEqual([
      'l',
      'r',
    ]);
    expect(handlesFor({ x: 0, y: 100, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 })).toEqual([
      't',
      'b',
    ]);
  });

  it('skips links whose ends are not on the canvas', () => {
    const graph = sampleGraph();
    const edges = flowEdges(
      {
        ...graph,
        edges: [
          ...graph.edges,
          { id: 'L_A_Z_0', source: 'A', target: 'Z', label: '', arrow: 'open', stroke: 'thick' },
        ],
      },
      POSITIONS,
      NO_SELECTION,
    );
    expect(edges).toHaveLength(2);
  });
});
