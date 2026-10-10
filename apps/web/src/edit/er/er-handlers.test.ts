import { describe, expect, it, vi } from 'vitest';

import {
  ENTITY_DRAG_TYPE,
  onConnect,
  onConnectEnd,
  onDelete,
  onDoubleClickItem,
  onDragOver,
  onDrop,
  onEdgesChange,
  onNodesChange,
  onPaneClick,
} from './er-handlers.ts';
import { NO_SELECTION } from './er-types.ts';
import { erTestContext } from '../../../tests/er-fixtures.ts';

import type { ErHandlerDeps } from './er-handlers.ts';
import type { ErCanvasEdge, ErCanvasNode, ErCanvasSelection } from './er-types.ts';
import type { ErTestContext } from '../../../tests/er-fixtures.ts';
import type { FinalConnectionState, InternalNode } from '@xyflow/react';
import type { DragEvent, SetStateAction } from 'react';

interface Harness extends ErHandlerDeps {
  context: ErTestContext;
  selection: () => ErCanvasSelection;
}

function harness(isReadOnly: boolean = false): Harness {
  let selection: ErCanvasSelection = NO_SELECTION;
  return {
    context: erTestContext(),
    setSelection: (update: SetStateAction<ErCanvasSelection>): void => {
      selection = typeof update === 'function' ? update(selection) : update;
    },
    selection: () => selection,
    setEditingId: vi.fn(),
    isReadOnly,
    toCanvas: (point) => ({ x: point.x - 10, y: point.y - 10 }),
  };
}

function drop(
  types: Record<string, string>,
  preventDefault: () => void = vi.fn(),
): DragEvent<HTMLElement> {
  const dataTransfer: unknown = {
    types: Object.keys(types),
    getData: (type: string) => types[type] ?? '',
  };
  const event: unknown = { clientX: 110, clientY: 210, preventDefault, dataTransfer };
  return event as DragEvent<HTMLElement>;
}

function connection(fromId: string | null, isValid: boolean): FinalConnectionState<InternalNode> {
  const state: unknown = { isValid, fromNode: fromId === null ? null : { id: fromId } };
  return state as FinalConnectionState<InternalNode>;
}

function canvasNode(id: string, type: 'entity' | 'subgraph'): ErCanvasNode {
  const node: unknown = { id, type, position: { x: 0, y: 0 }, data: {} };
  return node as ErCanvasNode;
}

function canvasEdge(id: string): ErCanvasEdge {
  return { id, source: '', target: '' };
}

describe('ER canvas events', () => {
  it('moves entities and selects from node changes', () => {
    const deps = harness();
    onNodesChange(deps, [
      { type: 'position', id: 'ORDER', position: { x: 5, y: 6 } },
      { type: 'select', id: 'SALES', selected: true },
    ]);
    expect(deps.context.stored().ORDER).toEqual({ x: 5, y: 6 });
    expect(deps.selection().group).toBe('SALES');
    onEdgesChange(deps, [{ type: 'select', id: 'R_ORDER_LINE_0', selected: true }]);
    expect(deps.selection().rels).toEqual(['R_ORDER_LINE_0']);
  });

  it('deletes tables, links and a group as one step', () => {
    const deps = harness();
    onDelete(deps, {
      nodes: [canvasNode('LINE', 'entity'), canvasNode('SALES', 'subgraph')],
      edges: [canvasEdge('R_CUSTOMER_ORDER_0')],
    });
    expect(deps.context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Deleted 3 items');
  });

  it('connects two entities', () => {
    const deps = harness();
    onConnect(deps, { source: 'LINE', target: 'CUSTOMER', sourceHandle: null, targetHandle: null });
    expect(deps.context.model().rels.at(-1)).toMatchObject({ from: 'LINE', to: 'CUSTOMER' });
  });

  it('makes a related entity where a link is dropped on empty canvas', () => {
    const deps = harness();
    const event = new MouseEvent('mouseup', { clientX: 300, clientY: 400 });
    onConnectEnd(deps, event, connection('ORDER', true));
    onConnectEnd(deps, event, connection(null, false));
    expect(deps.context.commits).not.toHaveBeenCalled();
    onConnectEnd(deps, event, connection('ORDER', false));
    expect(deps.context.stored().ENTITY?.y).toBe(390);
    expect(deps.context.model().rels.at(-1)).toMatchObject({ from: 'ORDER', to: 'ENTITY' });
  });

  it('reads a touch’s point for a dropped link', () => {
    const deps = harness();
    const touchEvent: unknown = { changedTouches: [{ clientX: 50, clientY: 70 }] };
    const touch = touchEvent as TouchEvent;
    onConnectEnd(deps, touch, connection('ORDER', false));
    expect(deps.context.stored().ENTITY?.y).toBe(60);
  });

  it('edits in place on double-click unless read-only, and stops editing on a pane click', () => {
    const deps = harness();
    onDoubleClickItem(deps, 'ORDER');
    expect(deps.setEditingId).toHaveBeenCalledWith('ORDER');
    deps.setSelection({ ...NO_SELECTION, group: 'SALES' });
    onPaneClick(deps);
    expect(deps.selection().group).toBeNull();
    expect(deps.setEditingId).toHaveBeenLastCalledWith(null);
    const readOnly = harness(true);
    onDoubleClickItem(readOnly, 'ORDER');
    expect(readOnly.setEditingId).not.toHaveBeenCalled();
  });

  it('adds an entity where the toolbar tool is dropped, and accepts only that drag', () => {
    const deps = harness();
    onDrop(deps, drop({ 'text/plain': 'x' }));
    expect(deps.context.commits).not.toHaveBeenCalled();
    const accept = vi.fn();
    const event = drop({ [ENTITY_DRAG_TYPE]: 'entity' }, accept);
    onDragOver(event);
    expect(accept).toHaveBeenCalled();
    onDrop(deps, event);
    expect(deps.context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Added entity ENTITY');
    const refuse = vi.fn();
    onDragOver(drop({ 'text/plain': 'x' }, refuse));
    expect(refuse).not.toHaveBeenCalled();
    const readOnly = harness(true);
    onDrop(readOnly, drop({ [ENTITY_DRAG_TYPE]: 'entity' }));
    onConnectEnd(readOnly, new MouseEvent('mouseup'), connection('ORDER', false));
    expect(readOnly.context.commits).not.toHaveBeenCalled();
  });
});
