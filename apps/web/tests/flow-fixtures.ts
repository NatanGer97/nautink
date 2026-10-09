import { emptyModel } from '@nautink/editors/flow/model';
import { vi } from 'vitest';

import type { FlowActionContext } from '../src/edit/flow/flow-actions.ts';
import type { FlowSelection } from '../src/edit/flow/flow-types.ts';
import type { FlowGraph } from '@nautink/editors/flow/model';
import type { PositionMap } from '@nautink/visual-core/positions';
import type { Mock } from 'vitest';

/** A → B → C, with B inside group G. */
export function sampleGraph(): FlowGraph {
  return {
    ...emptyModel(),
    nodes: [
      { id: 'A', label: 'Start', shape: 'stadium', classes: [] },
      { id: 'B', label: 'Check', shape: 'diam', classes: [] },
      { id: 'C', label: 'Done', shape: 'rect', classes: [] },
    ],
    edges: [
      { id: 'L_A_B_0', source: 'A', target: 'B', label: '', arrow: 'point', stroke: 'normal' },
      { id: 'L_B_C_0', source: 'B', target: 'C', label: 'yes', arrow: 'circle', stroke: 'dotted' },
    ],
    subgraphs: [{ id: 'G', title: 'Checks', members: ['B'], dir: '' }],
  };
}

export interface TestContext extends FlowActionContext {
  graph: () => FlowGraph;
  commits: Mock<(next: FlowGraph, label: string) => void>;
  selections: FlowSelection[];
  stored: () => PositionMap;
}

/** An action context over a graph that commits in place, with positions in memory. */
export function testContext(start: FlowGraph = sampleGraph()): TestContext {
  let graph: FlowGraph = start;
  let positions: PositionMap = { A: { x: 0, y: 0 }, B: { x: 0, y: 120 }, C: { x: 0, y: 240 } };
  const selections: FlowSelection[] = [];
  const commits = vi.fn((next: FlowGraph) => {
    graph = next;
  });
  return {
    graph: () => graph,
    getGraph: () => graph,
    commit: commits,
    commits,
    positions: {
      get: () => positions,
      set: (id, point): void => {
        positions = { ...positions, [id]: { ...positions[id], ...point } };
      },
      replace: (next): void => {
        positions = next;
      },
    },
    stored: () => positions,
    select: (selection): void => {
      selections.push(selection);
    },
    selections,
    setEditingId: vi.fn(),
    requestFit: vi.fn(),
  };
}
