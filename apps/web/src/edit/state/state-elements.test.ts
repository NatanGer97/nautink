import { addRegion, addState } from '@nautink/editors/state/ops';
import { describe, expect, it } from 'vitest';

import { handlesFor, stateEdges, stateNodes } from './state-elements.ts';
import { stateGeometry } from './state-geometry.ts';
import { NO_SELECTION } from './state-types.ts';
import { sampleModel, samplePositions } from '../../../tests/state-fixtures.ts';

describe('state canvas elements', () => {
  it('draws frames underneath, then leaves; a selected frame or leaf is marked', () => {
    const model = addRegion(sampleModel(), 'Box', 'Second');
    const positions = { ...samplePositions(), Second: { x: 400, y: 300 } };
    const nodes = stateNodes(model, stateGeometry(model, positions), {
      nodes: ['Idle'],
      edges: [],
      group: 'Box',
    });
    expect(nodes.slice(0, 3).map((node) => [node.id, node.type])).toEqual([
      ['Box', 'composite'],
      ['Box#0', 'region'],
      ['Box#1', 'region'],
    ]);
    expect(nodes.find((node) => node.id === 'Box')?.selected).toBe(true);
    expect(nodes.find((node) => node.id === 'Idle')).toMatchObject({
      type: 'leaf',
      selected: true,
    });
    expect(nodes.find((node) => node.id === 'note:Idle:0')).toMatchObject({ connectable: false });
    expect(nodes.find((node) => node.id === 'Box#0')).toMatchObject({
      selectable: false,
      draggable: false,
    });
  });

  it('draws an empty composite as a box of its own, and skips leaves without a spot', () => {
    const model = addState(sampleModel(), { id: 'Empty', isComposite: true });
    const nodes = stateNodes(
      model,
      stateGeometry(model, { ...samplePositions(), Empty: { x: 700, y: 0 } }),
      {
        ...NO_SELECTION,
        group: 'Empty',
      },
    );
    expect(nodes.find((node) => node.id === 'Empty')).toMatchObject({
      type: 'composite',
      selected: true,
      data: { isEmpty: true },
    });
    const unplaced = stateNodes(model, stateGeometry(model, {}), NO_SELECTION);
    expect(unplaced).toEqual([]);
  });

  it('picks facing sides, and the long sides of fork and join bars', () => {
    const box = { x: 0, y: 0, w: 100, h: 40 };
    expect(handlesFor(box, { x: 300, y: 0, w: 100, h: 40 })).toEqual(['r', 'l']);
    expect(handlesFor(box, { x: -300, y: 0, w: 100, h: 40 })).toEqual(['l', 'r']);
    expect(handlesFor(box, { x: 0, y: 300, w: 100, h: 40 })).toEqual(['b', 't']);
    expect(handlesFor(box, { x: 0, y: -300, w: 100, h: 40 })).toEqual(['t', 'b']);
    expect(handlesFor({ x: 0, y: 0, w: 90, h: 10 }, { x: 300, y: 100, w: 100, h: 40 })).toEqual([
      'b',
      't',
    ]);
    expect(handlesFor({ x: 0, y: 0, w: 10, h: 90 }, { x: 0, y: 300, w: 100, h: 40 })).toEqual([
      'r',
      'l',
    ]);
  });

  it('draws transitions with labels, parallels and self-loops, then dashed note links', () => {
    const base = sampleModel();
    const model = {
      ...base,
      transitions: [
        ...base.transitions,
        { id: 't3', from: 'Busy', to: 'Idle', label: '' },
        { id: 't4', from: 'Busy', to: 'Busy', label: 'again' },
        { id: 't5', from: 'Idle', to: 'Gone', label: '' },
      ],
    };
    const edges = stateEdges(model, stateGeometry(model, samplePositions()), {
      ...NO_SELECTION,
      edges: ['t1'],
    });
    expect(edges.map((edge) => edge.id)).toEqual(['t0', 't1', 't2', 't3', 't4', 'nl:note:Idle:0']);
    expect(edges[1]).toMatchObject({
      label: 'go',
      selected: true,
      data: { offset: -0.5, isSelf: false },
    });
    expect(edges[3]).toMatchObject({ data: { offset: 0.5, isFlipped: false } });
    expect(edges[4]).toMatchObject({
      sourceHandle: 'r',
      targetHandle: 't',
      data: { isSelf: true },
    });
    expect(edges[5]).toMatchObject({ type: 'straight', selectable: false });
    const unplaced = stateEdges(model, stateGeometry(model, {}), NO_SELECTION);
    expect(unplaced).toEqual([]);
  });
});
