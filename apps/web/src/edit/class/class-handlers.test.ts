import { afterEach, describe, expect, it, vi } from 'vitest';

import * as handlers from './class-handlers.ts';
import { handleClassKey } from './class-keys.ts';
import { CLASS_DRAG_TYPE } from './class-palette.ts';
import {
  applyEdgeSelection,
  applyNodeSelection,
  liveSelection,
  selectedItems,
  selectionOfIds,
} from './class-selection.ts';
import { NO_SELECTION } from './class-types.ts';
import { classContext, sampleModel } from '../../../tests/class-fixtures.ts';

import type { ClassHandlerDeps } from './class-handlers.ts';
import type { ClassKeyDeps } from './class-keys.ts';
import type { ClassCanvasEdge, ClassCanvasNode, ClassSelection } from './class-types.ts';
import type { ClassTestContext } from '../../../tests/class-fixtures.ts';
import type { FinalConnectionState, InternalNode } from '@xyflow/react';
import type { DragEvent, SetStateAction } from 'react';
import type { Mock } from 'vitest';

type TestDeps = ClassHandlerDeps & {
  context: ClassTestContext;
  current: () => ClassSelection;
  move: Mock<ClassHandlerDeps['move']>;
  setEditing: Mock<ClassHandlerDeps['setEditing']>;
  setFocusEdgeLabel: Mock<ClassHandlerDeps['setFocusEdgeLabel']>;
};

function handlerDeps(context: ClassTestContext = classContext()): TestDeps {
  let selection: ClassSelection = NO_SELECTION;
  return {
    context,
    setSelection: (update: SetStateAction<ClassSelection>): void => {
      selection = typeof update === 'function' ? update(selection) : update;
    },
    current: () => selection,
    setEditing: vi.fn<ClassHandlerDeps['setEditing']>(),
    setFocusEdgeLabel: vi.fn<ClassHandlerDeps['setFocusEdgeLabel']>(),
    isReadOnly: false,
    toCanvas: (point) => point,
    selection: NO_SELECTION,
    relationKind: 'association',
    move: vi.fn<ClassHandlerDeps['move']>(),
  };
}

function connectionState(
  fromId: string,
  isValid: boolean = false,
): FinalConnectionState<InternalNode> {
  const state: unknown = { isValid, fromNode: { id: fromId }, toNode: null };
  return state as FinalConnectionState<InternalNode>;
}

function dropEvent(kind: string, preventDefault: () => void = vi.fn()): DragEvent<HTMLElement> {
  const types: string[] = kind === 'foreign' ? ['text/plain'] : [CLASS_DRAG_TYPE];
  const event: unknown = {
    clientX: 500,
    clientY: 500,
    preventDefault,
    dataTransfer: { getData: (type: string) => (type === CLASS_DRAG_TYPE ? kind : ''), types },
  };
  return event as DragEvent<HTMLElement>;
}

function node(id: string, type: string = 'cls'): ClassCanvasNode {
  const value: unknown = { id, type };
  return value as ClassCanvasNode;
}

function edge(id: string): ClassCanvasEdge {
  const value: unknown = { id };
  return value as ClassCanvasEdge;
}

function pointerEvent(value: unknown): MouseEvent | TouchEvent {
  return value as MouseEvent;
}

const elementAt = vi.fn<(x: number, y: number) => Element | null>(() => null);
Object.defineProperty(document, 'elementFromPoint', { value: elementAt, configurable: true });

afterEach(() => {
  elementAt.mockReset();
});

describe('class handlers', () => {
  it('moves items, drags a frame with its content, and tracks selection', () => {
    const deps = handlerDeps();
    handlers.onNodesChange(deps, [
      { type: 'position', id: 'Bone', position: { x: 10, y: 20 } },
      { type: 'position', id: 'ns:Zoo', position: { x: 0, y: 0 } },
      { type: 'position', id: 'ns:Nowhere', position: { x: 0, y: 0 } },
      { type: 'position', id: 'Dog' },
      { type: 'select', id: 'Bone', selected: true },
      { type: 'select', id: 'ns:Zoo', selected: true },
    ]);
    expect(deps.context.positions.get().Bone).toEqual({ x: 10, y: 20 });
    expect(deps.move).toHaveBeenCalledWith(['Dog'], { x: 20, y: -158 });
    expect(deps.current()).toEqual({ nodes: ['Bone'], edges: [], group: 'Zoo' });
    handlers.onNodesChange(deps, [
      { type: 'select', id: 'ns:Zoo', selected: false },
      { type: 'select', id: 'ns:Other', selected: false },
    ]);
    expect(deps.current().group).toBeNull();
    handlers.onEdgesChange(deps, [
      { type: 'select', id: 'R:Dog:Bone:0', selected: true },
      { type: 'select', id: 'link:note:Dog:0', selected: true },
    ]);
    expect(deps.current().edges).toEqual(['R:Dog:Bone:0']);
    const empty = handlerDeps(classContext(null));
    handlers.onNodesChange(empty, [{ type: 'position', id: 'ns:Zoo', position: { x: 0, y: 0 } }]);
    expect(empty.move).not.toHaveBeenCalled();
  });

  it('deletes what React Flow removes, minus note links', () => {
    const deps = handlerDeps();
    handlers.onDelete(deps, {
      nodes: [node('Bone')],
      edges: [edge('link:note:Dog:0'), edge('R:Animal:Dog:0')],
    });
    expect(deps.context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Deleted 2 items');
  });

  it('connects classes with the toolbar kind and checks connections', () => {
    const deps = { ...handlerDeps(), relationKind: 'aggregation' };
    expect(
      handlers.isValidConnection(deps, {
        source: 'Dog',
        target: 'Bone',
        sourceHandle: null,
        targetHandle: null,
      }),
    ).toBe(true);
    handlers.onConnect(deps, {
      source: 'Dog',
      target: 'Animal',
      sourceHandle: null,
      targetHandle: null,
    });
    expect(deps.context.model().relations.at(-1)).toMatchObject({
      from: 'Dog',
      to: 'Animal',
      t1: 'agg',
    });
  });

  it('makes a linked class when a link is dropped on empty canvas, or connects to the node under it', () => {
    const deps = handlerDeps();
    const target = document.createElement('div');
    target.className = 'react-flow__node';
    target.dataset.id = 'Animal';
    document.body.append(target);
    elementAt.mockReturnValue(null);
    handlers.onConnectEnd(
      deps,
      new MouseEvent('mouseup', { clientX: 400, clientY: 400 }),
      connectionState('Bone'),
    );
    expect(deps.context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Added class Class1 linked to Chew toy',
    );
    elementAt.mockReturnValue(target);
    handlers.onConnectEnd(deps, new MouseEvent('mouseup'), connectionState('Bone'));
    expect(deps.context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Connected Chew toy → Animal',
    );
    target.dataset.id = 'ns:Zoo';
    handlers.onConnectEnd(deps, new MouseEvent('mouseup'), connectionState('note:Dog:0'));
    handlers.onConnectEnd(deps, new MouseEvent('mouseup'), connectionState('Bone', true));
    expect(deps.context.commits).toHaveBeenCalledTimes(2);
    target.remove();
  });

  it('reads touch points for a dropped link', () => {
    const deps = handlerDeps();
    elementAt.mockReturnValue(null);
    const touch = pointerEvent({ changedTouches: [{ clientX: 1, clientY: 2 }] });
    handlers.onConnectEnd(deps, touch, connectionState('Bone'));
    expect(deps.context.stored().Class1).toBeDefined();
    const other = handlerDeps();
    handlers.onConnectEnd(other, pointerEvent({}), connectionState('Bone'));
    expect(other.context.stored().Class1).toBeDefined();
  });

  it('edits in place on double-click, focuses a relation label, and clears on a pane click', () => {
    const deps = handlerDeps();
    handlers.onNodeDoubleClick(deps, node('Dog', 'cls'));
    expect(deps.setEditing).toHaveBeenLastCalledWith({ id: 'Dog', part: 'name' });
    handlers.onNodeDoubleClick(deps, node('note:Dog:0', 'note'));
    expect(deps.setEditing).toHaveBeenLastCalledWith({ id: 'note:Dog:0', part: 'note' });
    handlers.onNodeDoubleClick(deps, node('ns:Zoo', 'nsframe'));
    handlers.onNodeDoubleClick({ ...deps, isReadOnly: true }, node('Dog'));
    expect(deps.setEditing).toHaveBeenCalledTimes(2);
    handlers.onEdgeDoubleClick(deps, edge('R:Dog:Bone:0'));
    handlers.onEdgeDoubleClick(deps, edge('link:note:Dog:0'));
    expect(deps.current().edges).toEqual(['R:Dog:Bone:0']);
    expect(deps.setFocusEdgeLabel).toHaveBeenCalledTimes(1);
    handlers.onPaneClick(deps);
    expect(deps.setEditing).toHaveBeenLastCalledWith(null);
  });

  it('adds a dropped toolbar tile where it lands, and accepts only our drags', () => {
    const deps = handlerDeps();
    handlers.onDrop(deps, dropEvent('enumeration'));
    expect(deps.context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Added enum Enum1');
    handlers.onDrop(deps, dropEvent(''));
    handlers.onDrop({ ...deps, isReadOnly: true }, dropEvent('class'));
    expect(deps.context.commits).toHaveBeenCalledTimes(1);
    const accept = vi.fn();
    handlers.onDragOver(dropEvent('class', accept));
    expect(accept).toHaveBeenCalled();
    const refuse = vi.fn();
    handlers.onDragOver(dropEvent('foreign', refuse));
    expect(refuse).not.toHaveBeenCalled();
  });
});

describe('class selection', () => {
  it('applies select changes and keeps only what still exists', () => {
    const selection = applyNodeSelection(
      [
        { type: 'select', id: 'Dog', selected: true },
        { type: 'remove', id: 'X' },
      ],
      NO_SELECTION,
    );
    expect(applyEdgeSelection([{ type: 'remove', id: 'R' }], selection)).toBe(selection);
    expect(
      liveSelection(
        { nodes: ['Dog', 'Gone'], edges: ['R:Dog:Bone:0', 'R:x'], group: 'Gone' },
        sampleModel(),
      ),
    ).toEqual({
      nodes: ['Dog'],
      edges: ['R:Dog:Bone:0'],
      group: null,
    });
    expect(liveSelection(selection, null)).toEqual(NO_SELECTION);
  });

  it('selects Mermaid ids picked in Split, and reports labels and kinds', () => {
    const model = sampleModel();
    model.relations.push({ ...model.relations[0]!, id: 'R:I:Dog:0', from: 'I', t1: 'lolli' });
    model.relations.push({
      ...model.relations[0]!,
      id: 'R:Dog:P:0',
      from: 'Dog',
      to: 'P',
      t1: 'none',
      t2: 'lolli',
    });
    expect(selectionOfIds(model, ['Bone', 'Zoo'])).toEqual({
      nodes: ['Bone'],
      edges: [],
      group: 'Zoo',
    });
    expect(selectionOfIds(null, ['Bone'])).toEqual(NO_SELECTION);
    expect(
      selectedItems(model, {
        nodes: ['Bone', 'note:Dog:0', 'lolli:R:I:Dog:0', 'lolli:R:Dog:P:0'],
        edges: ['R:Dog:Bone:0'],
        group: 'Zoo',
      }),
    ).toEqual([
      { id: 'Bone', label: 'Chew toy', kind: 'class' },
      { id: 'note:Dog:0', label: 'Good boy', kind: 'note' },
      { id: 'lolli:R:I:Dog:0', label: 'I', kind: 'interface' },
      { id: 'lolli:R:Dog:P:0', label: 'P', kind: 'interface' },
      { id: 'R:Dog:Bone:0', label: 'Dog → Chew toy', kind: 'relation' },
      { id: 'Zoo', label: 'Zoo', kind: 'namespace' },
    ]);
    expect(selectedItems(null, NO_SELECTION)).toEqual([]);
  });
});

function keyDeps(
  selection: ClassSelection,
  context: ClassTestContext = classContext(),
): ClassKeyDeps & { context: ClassTestContext } {
  return {
    selection,
    context,
    isReadOnly: false,
    setEditing: vi.fn(),
    setSelection: vi.fn(),
    move: vi.fn(),
    fit: vi.fn(),
  };
}

function key(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('handleClassKey', () => {
  it('renames on Enter, duplicates on ⌘D and nudges with the arrows', () => {
    const deps = keyDeps({ ...NO_SELECTION, nodes: ['Dog'] });
    expect(handleClassKey(key({ key: 'Enter' }), deps)).toBe(true);
    expect(deps.setEditing).toHaveBeenLastCalledWith({ id: 'Dog', part: 'name' });
    expect(handleClassKey(key({ key: 'd', metaKey: true }), deps)).toBe(true);
    expect(deps.context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Duplicated Dog');
    expect(handleClassKey(key({ key: 'ArrowRight', shiftKey: true }), deps)).toBe(true);
    expect(deps.move).toHaveBeenLastCalledWith(['Dog'], { x: 10, y: 0 });
    const note = keyDeps({ ...NO_SELECTION, nodes: ['note:Dog:0'] });
    handleClassKey(key({ key: 'Enter' }), note);
    expect(note.setEditing).toHaveBeenLastCalledWith({ id: 'note:Dog:0', part: 'note' });
  });

  it('nudges a selected namespace with its content', () => {
    const deps = keyDeps({ ...NO_SELECTION, group: 'Zoo' });
    expect(handleClassKey(key({ key: 'ArrowUp' }), deps)).toBe(true);
    expect(deps.move).toHaveBeenLastCalledWith(['Dog'], { x: 0, y: -1 });
    expect(handleClassKey(key({ key: 'Enter' }), deps)).toBe(false);
  });

  it('fits on ⇧1, clears on Esc, and leaves other keys alone or read-only', () => {
    const deps = keyDeps(NO_SELECTION);
    expect(handleClassKey(key({ code: 'Digit1', key: '!', shiftKey: true }), deps)).toBe(true);
    expect(deps.fit).toHaveBeenCalled();
    expect(handleClassKey(key({ key: 'Escape' }), deps)).toBe(false);
    expect(deps.setSelection).toHaveBeenCalledWith(NO_SELECTION);
    expect(handleClassKey(key({ key: 'ArrowUp' }), deps)).toBe(false);
    expect(handleClassKey(key({ key: 'd', ctrlKey: true }), deps)).toBe(false);
    const readOnly = { ...keyDeps({ ...NO_SELECTION, nodes: ['Dog'] }), isReadOnly: true };
    expect(handleClassKey(key({ key: 'Enter' }), readOnly)).toBe(false);
    expect(
      handleClassKey(
        key({ key: 'Enter' }),
        keyDeps({ ...NO_SELECTION, nodes: ['Dog'] }, classContext(null)),
      ),
    ).toBe(false);
  });

  it('lets React Flow move a focused node with the arrows itself', () => {
    const deps = keyDeps({ ...NO_SELECTION, nodes: ['Dog'] });
    const focused = document.createElement('div');
    focused.className = 'react-flow__node';
    const event = key({ key: 'ArrowLeft' });
    Object.defineProperty(event, 'target', { value: focused });
    expect(handleClassKey(event, deps)).toBe(false);
  });
});
