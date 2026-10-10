import { describe, expect, it, vi } from 'vitest';

import * as handlers from './state-handlers.ts';
import { NO_SELECTION, STATE_DRAG_TYPE } from './state-types.ts';
import { stateContext } from '../../../tests/state-fixtures.ts';

import type { StateHandlerDeps } from './state-handlers.ts';
import type { StateCanvasEdge, StateCanvasNode, StateSelection } from './state-types.ts';
import type { FinalConnectionState, InternalNode } from '@xyflow/react';
import type { DragEvent, SetStateAction } from 'react';

function setup(overrides: Partial<StateHandlerDeps> = {}): StateHandlerDeps & {
  selection: StateSelection;
  current: () => StateSelection;
} {
  let selection: StateSelection = NO_SELECTION;
  const setSelection = vi.fn((update: SetStateAction<StateSelection>) => {
    selection = typeof update === 'function' ? update(selection) : update;
  });
  return {
    context: stateContext(),
    selection: NO_SELECTION,
    setSelection,
    setEditingId: vi.fn(),
    setFocusEdgeLabel: vi.fn(),
    isReadOnly: false,
    toCanvas: (point) => point,
    current: () => selection,
    ...overrides,
  };
}

function node(id: string, type: 'leaf' | 'composite' | 'region'): StateCanvasNode {
  const position = { x: 0, y: 0 };
  if (type === 'leaf') {
    return { id, type, position, data: { leaf: { kind: 'state', label: id, desc: [] } } };
  }
  if (type === 'composite') {
    return { id, type, position, data: { label: id, width: 1, height: 1, isEmpty: false } };
  }
  return { id, type, position, data: { width: 1, height: 1 } };
}

function edge(id: string): StateCanvasEdge {
  return { id, source: 'a', target: 'b' };
}

function connectionEnd(
  fromId: string | undefined,
  isValid: boolean,
): FinalConnectionState<InternalNode> {
  return {
    isValid,
    fromNode: fromId === undefined ? null : { id: fromId },
    toNode: null,
  } as unknown as FinalConnectionState<InternalNode>;
}

function drop(kind: string): DragEvent<HTMLElement> {
  return {
    clientX: 900,
    clientY: 900,
    preventDefault: vi.fn(),
    dataTransfer: {
      getData: (type: string) => (type === STATE_DRAG_TYPE ? kind : ''),
      types: [STATE_DRAG_TYPE],
    },
  } as unknown as DragEvent<HTMLElement>;
}

describe('state canvas handlers', () => {
  it('moves dragged items and tracks node and edge selection', () => {
    const deps = setup();
    handlers.onNodesChange(deps, [
      { type: 'position', id: 'Busy', position: { x: 5, y: 250 } },
      { type: 'select', id: 'Box', selected: true },
    ]);
    expect(deps.context.positions.get().Busy).toMatchObject({ x: 5, y: 250 });
    expect(deps.current().group).toBe('Box');
    handlers.onEdgesChange(deps, [{ type: 'select', id: 't1', selected: true }]);
    expect(deps.current().edges).toEqual(['t1']);
    handlers.onNodesChange(
      { ...deps, context: { ...deps.context, getModel: (): null => null } },
      [],
    );
  });

  it('deletes leaves, a frame and transitions, but never note links', () => {
    const deps = setup();
    handlers.onDelete(deps, {
      nodes: [node('Busy', 'leaf'), node('Box', 'composite'), node('Box#0', 'region')],
      edges: [edge('t0'), edge('nl:note:Idle:0')],
    });
    expect(deps.context.getModel()?.states.map((state) => state.id)).toEqual(['Idle']);
    expect(deps.context.getModel()?.transitions).toEqual([]);
    handlers.onDelete(
      { ...deps, context: { ...deps.context, getModel: (): null => null } },
      { nodes: [], edges: [] },
    );
  });

  it('checks and makes connections', () => {
    const deps = setup();
    expect(handlers.isValidConnection(deps.context, { source: 'Idle', target: 'Busy' })).toBe(true);
    handlers.onConnect(deps, {
      source: 'Busy',
      target: 'Idle',
      sourceHandle: 'r',
      targetHandle: 'l',
    });
    expect(deps.context.getModel()?.transitions.at(-1)).toMatchObject({ from: 'Busy', to: 'Idle' });
  });

  it('makes a connected state where a transition is dropped on empty canvas, inside a [*]’s scope', () => {
    const deps = setup();
    const event = new MouseEvent('mouseup', { clientX: 900, clientY: 900 });
    handlers.onConnectEnd(deps, event, connectionEnd('Busy', true));
    handlers.onConnectEnd(deps, event, connectionEnd(undefined, false));
    handlers.onConnectEnd(deps, event, connectionEnd('note:Idle:0', false));
    expect(deps.context.getModel()?.states).toHaveLength(4);
    handlers.onConnectEnd(deps, event, connectionEnd('Busy', false));
    expect(deps.context.getModel()?.transitions.at(-1)).toMatchObject({
      from: 'Busy',
      to: 'State1',
    });
    handlers.onConnectEnd(deps, event, connectionEnd('start:Box', false));
    expect(deps.context.getModel()?.states.at(-1)).toMatchObject({ id: 'State2', parent: 'Box' });
    const touch = { changedTouches: [{ clientX: 1, clientY: 2 }] } as unknown as TouchEvent;
    handlers.onConnectEnd(deps, touch, connectionEnd('Idle', false));
    expect(deps.context.getModel()?.states.at(-1)?.id).toBe('State3');
  });

  it('renames on double-click and focuses a transition label', () => {
    const deps = setup();
    handlers.onNodeDoubleClick(deps, node('Idle', 'leaf'));
    handlers.onNodeDoubleClick(deps, node('start:', 'leaf'));
    expect(deps.setEditingId).toHaveBeenCalledTimes(1);
    handlers.onEdgeDoubleClick(deps, edge('nl:note:Idle:0'));
    handlers.onEdgeDoubleClick(deps, edge('t1'));
    expect(deps.current()).toEqual({ ...NO_SELECTION, edges: ['t1'] });
    expect(deps.setFocusEdgeLabel).toHaveBeenCalledWith(true);
    handlers.onPaneClick(deps);
    expect(deps.setEditingId).toHaveBeenLastCalledWith(null);
  });

  it('adds a dropped toolbar item, and accepts only our drops', () => {
    const deps = setup();
    handlers.onDrop(deps, drop('other'));
    handlers.onDrop({ ...deps, isReadOnly: true }, drop('state'));
    expect(deps.context.getModel()?.states).toHaveLength(4);
    handlers.onDrop(deps, drop('join'));
    expect(deps.context.getModel()?.states.at(-1)?.id).toBe('Join1');
    const accept = vi.fn();
    handlers.onDragOver({ ...drop('state'), preventDefault: accept });
    expect(accept).toHaveBeenCalled();
    const refuse = vi.fn();
    const foreign = {
      preventDefault: refuse,
      dataTransfer: { types: ['text/plain'] },
    } as unknown as DragEvent<HTMLElement>;
    handlers.onDragOver(foreign);
    expect(refuse).not.toHaveBeenCalled();
  });
});
