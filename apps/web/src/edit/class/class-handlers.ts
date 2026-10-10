// React Flow's events on the class canvas (v1's ClassEditor `onNodesChange`, `onConnectEnd`,
// `onDrop` …), as plain functions over what they need, so the canvas component only wires them.
import { addItem } from './class-actions.ts';
import { classBoxes, framedIds } from './class-boxes.ts';
import { canConnect, connect, deleteSelection } from './class-item-actions.ts';
import { itemKind } from './class-names.ts';
import { CLASS_DRAG_TYPE, paletteItem } from './class-palette.ts';
import { applyEdgeSelection, applyNodeSelection } from './class-selection.ts';
import { FRAME_PREFIX, NO_SELECTION, NOTE_LINK_PREFIX } from './class-types.ts';

import type { ClassActionContext } from './class-action-context.ts';
import type { PaletteItem } from './class-palette.ts';
import type {
  ClassCanvasEdge,
  ClassCanvasNode,
  ClassEditing,
  ClassSelection,
} from './class-types.ts';
import type { ClassModel } from '@nautink/editors/class/types';
import type { Point, Rect } from '@nautink/visual-core/geometry';
import type {
  Connection,
  EdgeChange,
  FinalConnectionState,
  InternalNode,
  NodeChange,
} from '@xyflow/react';
import type { DragEvent, SetStateAction } from 'react';

export interface ClassHandlerDeps {
  context: ClassActionContext;
  setSelection: (update: SetStateAction<ClassSelection>) => void;
  setEditing: (editing: ClassEditing | null) => void;
  setFocusEdgeLabel: (isFocused: boolean) => void;
  isReadOnly: boolean;
  /** Screen pixels → canvas coordinates (`useReactFlow().screenToFlowPosition`). */
  toCanvas: (point: Point) => Point;
  /** The selection (where a new item goes) and the toolbar's kind for new links. */
  selection: ClassSelection;
  relationKind: string;
  /** Moves items by a delta (dragging a namespace frame moves its content). */
  move: (ids: readonly string[], delta: Point) => void;
}

/** Dragging a namespace frame moves everything inside it (v1). */
function moveFrame(deps: ClassHandlerDeps, frameId: string, to: Point): void {
  const model: ClassModel | null = deps.context.getModel();
  const box: Rect | undefined =
    model === null ? undefined : classBoxes(model, deps.context.positions.get()).get(frameId);
  if (model === null || box === undefined) {
    return;
  }
  const ids: string[] = framedIds(model, frameId.slice(FRAME_PREFIX.length));
  deps.move(ids, { x: to.x - box.x, y: to.y - box.y });
}

/** Moves and selection from React Flow. Removals are handled by `onDelete`. */
export function onNodesChange(
  deps: ClassHandlerDeps,
  changes: NodeChange<ClassCanvasNode>[],
): void {
  for (const change of changes) {
    if (change.type !== 'position' || change.position === undefined) {
      continue;
    }
    if (change.id.startsWith(FRAME_PREFIX)) {
      moveFrame(deps, change.id, change.position);
    } else {
      deps.context.positions.set(change.id, change.position);
    }
  }
  deps.setSelection((current) => applyNodeSelection(changes, current));
}

export function onEdgesChange(
  deps: ClassHandlerDeps,
  changes: EdgeChange<ClassCanvasEdge>[],
): void {
  deps.setSelection((current) => applyEdgeSelection(changes, current));
}

/** Delete or Backspace: classes, notes, lollipops, relations and namespaces, as one step. */
export function onDelete(
  deps: ClassHandlerDeps,
  { nodes, edges }: { nodes: ClassCanvasNode[]; edges: ClassCanvasEdge[] },
): void {
  deleteSelection(deps.context, {
    nodes: nodes.map((node) => node.id),
    edges: edges.filter((edge) => !edge.id.startsWith(NOTE_LINK_PREFIX)).map((edge) => edge.id),
    group: null,
  });
}

export function isValidConnection(
  deps: ClassHandlerDeps,
  { source, target }: Connection | ClassCanvasEdge,
): boolean {
  return canConnect(deps.context.getModel(), source, target);
}

export function onConnect(deps: ClassHandlerDeps, { source, target }: Connection): void {
  connect(deps.context, { source, target, kindId: deps.relationKind });
}

function pointOf(event: MouseEvent | TouchEvent): Point {
  const touch: Touch | undefined = 'changedTouches' in event ? event.changedTouches[0] : undefined;
  if (touch !== undefined) {
    return { x: touch.clientX, y: touch.clientY };
  }
  return 'clientX' in event ? { x: event.clientX, y: event.clientY } : { x: 0, y: 0 };
}

/** The item under the pointer, if any. Namespace frames count as empty canvas. */
function itemAt(point: Point): string | null {
  const node: Element | null | undefined = document
    .elementFromPoint(point.x, point.y)
    ?.closest('.react-flow__node');
  const id: string | null = node?.getAttribute('data-id') ?? null;
  return id === null || id.startsWith(FRAME_PREFIX) ? null : id;
}

function addLinkedClass(deps: ClassHandlerDeps, fromId: string, point: Point): void {
  addItem(deps.context, {
    kind: 'class',
    at: deps.toCanvas(point),
    selection: deps.selection,
    relationKind: deps.relationKind,
    connectFrom: fromId,
  });
}

/**
 * A link dropped on a node's body connects to it; dropped on empty canvas from a class, it makes a
 * connected class there (v1).
 */
export function onConnectEnd(
  deps: ClassHandlerDeps,
  event: MouseEvent | TouchEvent,
  state: FinalConnectionState<InternalNode>,
): void {
  const fromId: string | undefined = state.fromNode?.id;
  const model: ClassModel | null = deps.context.getModel();
  if (state.isValid === true || fromId === undefined || model === null) {
    return;
  }
  const point: Point = pointOf(event);
  const hit: string | null = itemAt(point);
  if (hit !== null && hit !== fromId) {
    onConnect(deps, { source: fromId, target: hit, sourceHandle: null, targetHandle: null });
  }
  const isOnEmptyCanvas: boolean = hit === null && state.toNode === null;
  if (isOnEmptyCanvas && itemKind(model, fromId) === 'class') {
    addLinkedClass(deps, fromId, point);
  }
}

export function onNodeDoubleClick(deps: ClassHandlerDeps, node: ClassCanvasNode): void {
  if (deps.isReadOnly) {
    return;
  }
  if (node.type === 'cls') {
    deps.setEditing({ id: node.id, part: 'name' });
  } else if (node.type === 'note') {
    deps.setEditing({ id: node.id, part: 'note' });
  }
}

/** Double-clicking a relation selects it and opens the inspector with its label focused (v1). */
export function onEdgeDoubleClick(deps: ClassHandlerDeps, edge: ClassCanvasEdge): void {
  if (!edge.id.startsWith(NOTE_LINK_PREFIX)) {
    deps.setSelection({ ...NO_SELECTION, edges: [edge.id] });
    deps.setFocusEdgeLabel(true);
  }
}

export function onPaneClick(deps: ClassHandlerDeps): void {
  deps.setSelection((current) => ({ ...current, group: null }));
  deps.setEditing(null);
}

export function onDrop(deps: ClassHandlerDeps, event: DragEvent<HTMLElement>): void {
  const kind: string = event.dataTransfer.getData(CLASS_DRAG_TYPE);
  const item: PaletteItem | undefined = paletteItem(kind);
  if (item === undefined) {
    return;
  }
  event.preventDefault();
  if (!deps.isReadOnly) {
    addItem(deps.context, {
      kind: item.kind,
      at: deps.toCanvas({ x: event.clientX, y: event.clientY }),
      selection: deps.selection,
      relationKind: deps.relationKind,
    });
  }
}

/** Lets the canvas accept a drop of the toolbar's tiles (and nothing else). */
export function onDragOver(event: DragEvent<HTMLElement>): void {
  if (event.dataTransfer.types.includes(CLASS_DRAG_TYPE)) {
    event.preventDefault();
  }
}
