// React Flow's events on the ER canvas (v1's `onNodesChange`, `onConnectEnd`, `onDrop` …), as
// plain functions over what they need, so the canvas component only wires them up.
import { addEntity, connect, deleteSelection } from './er-actions.ts';
import { applyEdgeSelection, applyNodeSelection, nodeMoves } from './er-selection.ts';

import type { ErActionContext } from './er-actions.ts';
import type { ErCanvasEdge, ErCanvasNode, ErCanvasSelection } from './er-types.ts';
import type { ErModel } from '@nautink/editors/er/model';
import type { Point } from '@nautink/visual-core/geometry';
import type {
  Connection,
  EdgeChange,
  FinalConnectionState,
  InternalNode,
  NodeChange,
} from '@xyflow/react';
import type { DragEvent, SetStateAction } from 'react';

/** The drag type of the toolbar's entity tool. */
export const ENTITY_DRAG_TYPE: string = 'application/x-nautink-er-entity';

export interface ErHandlerDeps {
  context: ErActionContext;
  setSelection: (update: SetStateAction<ErCanvasSelection>) => void;
  setEditingId: (id: string | null) => void;
  isReadOnly: boolean;
  /** Screen pixels → canvas coordinates (`useReactFlow().screenToFlowPosition`). */
  toCanvas: (point: Point) => Point;
}

function groupIdsOf(model: ErModel | null): Set<string> {
  return new Set<string>((model?.subgraphs ?? []).map((group) => group.id));
}

function pointOf(event: MouseEvent | TouchEvent): Point {
  const touch: Touch | undefined = 'changedTouches' in event ? event.changedTouches[0] : undefined;
  if (touch !== undefined) {
    return { x: touch.clientX, y: touch.clientY };
  }
  return 'clientX' in event ? { x: event.clientX, y: event.clientY } : { x: 0, y: 0 };
}

/** Selection and moves from React Flow. Removals are handled by `onDelete`. */
export function onNodesChange(deps: ErHandlerDeps, changes: NodeChange<ErCanvasNode>[]): void {
  const groupIds: Set<string> = groupIdsOf(deps.context.getModel());
  for (const [id, position] of nodeMoves(changes, groupIds)) {
    deps.context.positions.set(id, position);
  }
  deps.setSelection((current) => applyNodeSelection(changes, current, groupIds));
}

export function onEdgesChange(deps: ErHandlerDeps, changes: EdgeChange<ErCanvasEdge>[]): void {
  deps.setSelection((current) => applyEdgeSelection(changes, current));
}

/** Delete or Backspace: entities (with their relationships), relationships and a group, as one step. */
export function onDelete(
  deps: ErHandlerDeps,
  { nodes, edges }: { nodes: ErCanvasNode[]; edges: ErCanvasEdge[] },
): void {
  const groups: ErCanvasNode[] = nodes.filter((node) => node.type === 'subgraph');
  deleteSelection(deps.context, {
    entities: nodes.filter((node) => node.type === 'entity').map((node) => node.id),
    rels: edges.map((edge) => edge.id),
    group: groups[0]?.id ?? null,
  });
}

export function onConnect(deps: ErHandlerDeps, { source, target }: Connection): void {
  connect(deps.context, source, target);
}

/** A link dropped on empty canvas makes a related entity there (v1). */
export function onConnectEnd(
  deps: ErHandlerDeps,
  event: MouseEvent | TouchEvent,
  state: FinalConnectionState<InternalNode>,
): void {
  const fromId: string | undefined = state.fromNode?.id;
  if (state.isValid === true || fromId === undefined || deps.isReadOnly) {
    return;
  }
  addEntity(deps.context, { at: deps.toCanvas(pointOf(event)), connectFrom: fromId });
}

/** Double-clicking a table renames it in place; a link edits its label in place (v1). */
export function onDoubleClickItem(deps: ErHandlerDeps, id: string): void {
  if (!deps.isReadOnly) {
    deps.setEditingId(id);
  }
}

export function onPaneClick(deps: ErHandlerDeps): void {
  deps.setSelection((current) => ({ ...current, group: null }));
  deps.setEditingId(null);
}

export function onDrop(deps: ErHandlerDeps, event: DragEvent<HTMLElement>): void {
  if (event.dataTransfer.getData(ENTITY_DRAG_TYPE) === '') {
    return;
  }
  event.preventDefault();
  if (!deps.isReadOnly) {
    addEntity(deps.context, { at: deps.toCanvas({ x: event.clientX, y: event.clientY }) });
  }
}

/** Lets the canvas accept a drop of the entity tool (and nothing else). */
export function onDragOver(event: DragEvent<HTMLElement>): void {
  if (event.dataTransfer.types.includes(ENTITY_DRAG_TYPE)) {
    event.preventDefault();
  }
}
