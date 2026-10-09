import { describe, expect, it } from 'vitest';

import {
  applyEdgeChanges,
  applyNodeSelection,
  liveSelection,
  nodeMoves,
  selectedItems,
  selectionOfIds,
} from './flow-selection.ts';
import { NO_SELECTION } from './flow-types.ts';
import { sampleGraph } from '../../../tests/flow-fixtures.ts';

const GROUPS = new Set(['G']);

describe('flow selection', () => {
  it('follows React Flow select changes for nodes, links and the one group', () => {
    let selection = applyNodeSelection(
      [
        { id: 'A', type: 'select', selected: true },
        { id: 'G', type: 'select', selected: true },
        { id: 'A', type: 'dimensions' },
      ],
      NO_SELECTION,
      GROUPS,
    );
    expect(selection).toEqual({ nodes: ['A'], edges: [], group: 'G' });
    selection = applyNodeSelection(
      [{ id: 'X', type: 'select', selected: false }],
      selection,
      new Set(['X']),
    );
    expect(selection.group).toBe('G');
    selection = applyNodeSelection(
      [
        { id: 'G', type: 'select', selected: false },
        { id: 'A', type: 'select', selected: false },
      ],
      selection,
      GROUPS,
    );
    expect(selection).toEqual(NO_SELECTION);
    expect(
      applyEdgeChanges(
        [
          { id: 'L_A_B_0', type: 'select', selected: true },
          { id: 'L_A_B_0', type: 'remove' },
        ],
        NO_SELECTION,
      ).edges,
    ).toEqual(['L_A_B_0']);
  });

  it('records node moves but never moves a group frame', () => {
    expect(
      nodeMoves(
        [
          { id: 'A', type: 'position', position: { x: 1, y: 2 } },
          { id: 'G', type: 'position', position: { x: 9, y: 9 } },
          { id: 'B', type: 'position' },
        ],
        GROUPS,
      ),
    ).toEqual([['A', { x: 1, y: 2 }]]);
  });

  it('drops ids an outside change removed', () => {
    const graph = sampleGraph();
    expect(
      liveSelection({ nodes: ['A', 'Z', 'G'], edges: ['L_A_B_0', 'L_x'], group: 'Q' }, graph),
    ).toEqual({
      nodes: ['A'],
      edges: ['L_A_B_0'],
      group: null,
    });
    expect(liveSelection({ nodes: ['A'], edges: [], group: 'G' }, null)).toEqual(NO_SELECTION);
  });

  it('selects Mermaid ids from the preview half of Split', () => {
    expect(selectionOfIds(sampleGraph(), ['B', 'L_B_C_0', 'G'])).toEqual({
      nodes: ['B'],
      edges: ['L_B_C_0'],
      group: 'G',
    });
    expect(selectionOfIds(null, ['B'])).toEqual(NO_SELECTION);
  });

  it('names the selection for the app-wide store', () => {
    expect(selectedItems(sampleGraph(), { nodes: ['A'], edges: ['L_A_B_0'], group: 'G' })).toEqual([
      { id: 'A', label: 'Start', kind: 'node' },
      { id: 'L_A_B_0', label: 'Start → Check', kind: 'link' },
      { id: 'G', label: 'Checks', kind: 'group' },
    ]);
    expect(selectedItems(null, NO_SELECTION)).toEqual([]);
  });
});
