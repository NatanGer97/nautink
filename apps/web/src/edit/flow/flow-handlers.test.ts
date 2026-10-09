import { describe, expect, it, vi } from 'vitest';

import { iconDragData, parseIconDrop, SHAPE_DRAG_TYPE } from './flow-drop.ts';
import * as handlers from './flow-handlers.ts';
import { NO_SELECTION } from './flow-types.ts';
import { testContext } from '../../../tests/flow-fixtures.ts';
import { ICON_DRAG_TYPE } from '../library/icon-library.tsx';

import type { FlowHandlerDeps } from './flow-handlers.ts';
import type { FlowSelection } from './flow-types.ts';
import type { FinalConnectionState, InternalNode } from '@xyflow/react';
import type { DragEvent, SetStateAction } from 'react';

function deps(): FlowHandlerDeps & { selection: () => FlowSelection } {
  let selection: FlowSelection = NO_SELECTION;
  return {
    context: testContext(),
    setSelection: (update: SetStateAction<FlowSelection>): void => {
      selection = typeof update === 'function' ? update(selection) : update;
    },
    selection: () => selection,
    setEditingId: vi.fn(),
    setFocusEdgeLabel: vi.fn(),
    isReadOnly: false,
    toCanvas: (point) => point,
  };
}

function connectionEnd(fromId: string, isValid: boolean): FinalConnectionState<InternalNode> {
  const state: unknown = { isValid, fromNode: { id: fromId } };
  return state as FinalConnectionState<InternalNode>;
}

function dragEvent(
  data: Record<string, string>,
  preventDefault: () => void,
): DragEvent<HTMLElement> {
  const event: unknown = { dataTransfer: transfer(data), clientX: 0, clientY: 0, preventDefault };
  return event as DragEvent<HTMLElement>;
}

function transfer(data: Record<string, string>): DataTransfer {
  return {
    getData: (type: string) => data[type] ?? '',
    types: Object.keys(data),
  } as unknown as DataTransfer;
}

describe('flowchart canvas events', () => {
  it('moves nodes and follows selection changes', () => {
    const events = deps();
    handlers.onNodesChange(events, [
      { id: 'A', type: 'position', position: { x: 5, y: 6 } },
      { id: 'A', type: 'select', selected: true },
    ]);
    expect(events.context.positions.get().A).toEqual({ x: 5, y: 6 });
    handlers.onEdgesChange(events, [{ id: 'L_A_B_0', type: 'select', selected: true }]);
    expect(events.selection()).toEqual({ nodes: ['A'], edges: ['L_A_B_0'], group: null });
    handlers.onPaneClick(events);
    expect(events.setEditingId).toHaveBeenCalledWith(null);
  });

  it('deletes what React Flow hands over, as one step', () => {
    const events = deps();
    handlers.onDelete(events, {
      nodes: [
        {
          id: 'A',
          type: 'shape',
          position: { x: 0, y: 0 },
          data: { node: events.context.getGraph()!.nodes[0]! },
        },
        {
          id: 'G',
          type: 'subgraph',
          position: { x: 0, y: 0 },
          data: { title: '', width: 1, height: 1 },
        },
      ],
      edges: [],
    });
    expect(events.context.getGraph()?.nodes.map((node) => node.id)).toEqual(['B', 'C']);
    expect(events.context.getGraph()?.subgraphs).toEqual([]);
  });

  it('connects nodes, and makes a node where a link is dropped on empty canvas', () => {
    const events = deps();
    handlers.onConnect(events, {
      source: 'A',
      target: 'C',
      sourceHandle: null,
      targetHandle: null,
    });
    expect(events.context.getGraph()?.edges.at(-1)).toMatchObject({ source: 'A', target: 'C' });
    handlers.onConnectEnd(
      events,
      new MouseEvent('mouseup', { clientX: 10, clientY: 20 }),
      connectionEnd('B', false),
    );
    expect(events.context.getGraph()?.nodes.at(-1)).toMatchObject({ id: 'n1', shape: 'rect' });
    handlers.onConnectEnd(events, new MouseEvent('mouseup'), connectionEnd('A', true));
    handlers.onConnectEnd(events, new MouseEvent('mouseup'), connectionEnd('G', false));
    expect(events.context.getGraph()?.nodes).toHaveLength(4);
  });

  it('continues the shape a link starts from, except markers and decisions', () => {
    expect(handlers.continuedShape({ id: 'x', label: '', shape: 'cyl', classes: [] })).toBe('cyl');
    expect(handlers.continuedShape({ id: 'x', label: '', shape: 'diam', classes: [] })).toBe(
      'rect',
    );
    expect(
      handlers.continuedShape({ id: 'x', label: '', shape: 'rect', icon: 'mdi:x', classes: [] }),
    ).toBe('rect');
    expect(handlers.continuedShape(undefined)).toBe('rect');
  });

  it('opens a node for renaming on double-click, and a link label in the inspector', () => {
    const events = deps();
    handlers.onNodeDoubleClick(events, {
      id: 'G',
      type: 'subgraph',
      position: { x: 0, y: 0 },
      data: { title: '', width: 1, height: 1 },
    });
    expect(events.setEditingId).not.toHaveBeenCalled();
    handlers.onNodeDoubleClick(events, {
      id: 'A',
      type: 'shape',
      position: { x: 0, y: 0 },
      data: { node: events.context.getGraph()!.nodes[0]! },
    });
    expect(events.setEditingId).toHaveBeenCalledWith('A');
    handlers.onEdgeDoubleClick(events, { id: 'L_A_B_0', source: 'A', target: 'B' });
    expect(events.selection()).toEqual({ ...NO_SELECTION, edges: ['L_A_B_0'] });
    expect(events.setFocusEdgeLabel).toHaveBeenCalledWith(true);
  });

  it('accepts drops of shapes and icons only', () => {
    expect(handlers.droppedShape(transfer({ [SHAPE_DRAG_TYPE]: 'cyl' }))).toEqual({ shape: 'cyl' });
    expect(
      handlers.droppedShape(transfer({ [ICON_DRAG_TYPE]: iconDragData('mdi:db', '') })),
    ).toEqual({ icon: 'mdi:db', form: '' });
    expect(handlers.droppedShape(transfer({ 'text/plain': 'x' }))).toBeNull();
    expect(parseIconDrop('logos:aws')).toEqual({ icon: 'logos:aws', form: 'square' });
    expect(parseIconDrop('{"icon":1}')).toBeNull();
    expect(parseIconDrop('nope')).toBeNull();
    const events = deps();
    const preventDefault = vi.fn();
    handlers.onDrop(events, dragEvent({ [SHAPE_DRAG_TYPE]: 'cyl' }, preventDefault));
    expect(preventDefault).toHaveBeenCalled();
    expect(events.context.getGraph()?.nodes.at(-1)?.shape).toBe('cyl');
    handlers.onDrop(events, dragEvent({}, preventDefault));
    const over = vi.fn();
    handlers.onDragOver(dragEvent({ [ICON_DRAG_TYPE]: 'x' }, over));
    handlers.onDragOver(dragEvent({ 'text/plain': 'x' }, over));
    expect(over).toHaveBeenCalledTimes(1);
  });
});
