import { describe, expect, it } from 'vitest';

import {
  applyEdgeSelection,
  applyNodeSelection,
  liveSelection,
  selectedItems,
  selectionOfIds,
} from './state-selection.ts';
import { NO_SELECTION } from './state-types.ts';
import { sampleModel } from '../../../tests/state-fixtures.ts';

const FRAMES: ReadonlySet<string> = new Set(['Box']);

describe('state selection', () => {
  it('applies node and edge select changes; frames select as the group', () => {
    const picked = applyNodeSelection(
      [
        { type: 'select', id: 'Idle', selected: true },
        { type: 'select', id: 'Box', selected: true },
        { type: 'position', id: 'Busy' },
      ],
      NO_SELECTION,
      FRAMES,
    );
    expect(picked).toEqual({ nodes: ['Idle'], edges: [], group: 'Box' });
    const dropped = applyNodeSelection(
      [
        { type: 'select', id: 'Box', selected: false },
        { type: 'select', id: 'Idle', selected: false },
      ],
      picked,
      FRAMES,
    );
    expect(dropped).toEqual(NO_SELECTION);
    expect(
      applyNodeSelection(
        [{ type: 'select', id: 'Box', selected: false }],
        { ...NO_SELECTION, group: 'Other' },
        FRAMES,
      ).group,
    ).toBe('Other');
    expect(
      applyNodeSelection(
        [{ type: 'select', id: 'Empty', selected: false }],
        { ...NO_SELECTION, group: 'Empty' },
        FRAMES,
      ).group,
    ).toBeNull();
    const edges = applyEdgeSelection(
      [
        { type: 'select', id: 't1', selected: true },
        { type: 'remove', id: 't2' },
      ],
      NO_SELECTION,
    );
    expect(edges.edges).toEqual(['t1']);
  });

  it('drops what an outside change removed', () => {
    const model = sampleModel();
    expect(
      liveSelection({ nodes: ['Idle', 'Gone'], edges: ['t1', 't9'], group: 'Box' }, model),
    ).toEqual({
      nodes: ['Idle'],
      edges: ['t1'],
      group: 'Box',
    });
    expect(liveSelection({ ...NO_SELECTION, group: 'Idle' }, model).group).toBeNull();
    expect(liveSelection({ ...NO_SELECTION, nodes: ['Idle'] }, null)).toEqual(NO_SELECTION);
  });

  it('selects Mermaid ids from Split: leaves, a composite frame and transitions', () => {
    const model = sampleModel();
    expect(selectionOfIds(model, ['Idle', 'Box', 't1', 'nope'])).toEqual({
      nodes: ['Idle'],
      edges: ['t1'],
      group: 'Box',
    });
    expect(selectionOfIds(null, ['Idle'])).toEqual(NO_SELECTION);
  });

  it('publishes Mermaid ids and names: states, [*], notes and transitions', () => {
    const model = sampleModel();
    expect(
      selectedItems(model, {
        nodes: ['Idle', 'start:', 'end:Box', 'note:Idle:0'],
        edges: ['t1'],
        group: 'Box',
      }),
    ).toEqual([
      { id: 'Idle', label: 'Idle', kind: 'state' },
      { id: '[*]', label: 'Start', kind: 'state' },
      { id: '[*]', label: 'End in Box', kind: 'state' },
      { id: 'Idle', label: 'Note: Waits', kind: 'note' },
      { id: 'Box', label: 'Box', kind: 'state' },
      { id: 't1', label: 'Idle → Busy', kind: 'transition' },
    ]);
    expect(selectedItems(model, { ...NO_SELECTION, nodes: ['Gone'] })).toEqual([
      { id: 'Gone', label: 'Gone', kind: 'state' },
    ]);
    expect(selectedItems(null, NO_SELECTION)).toEqual([]);
  });
});
