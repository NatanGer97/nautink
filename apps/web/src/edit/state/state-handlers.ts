// React Flow's events on the state canvas (v1's `onNodesChange`, `onConnectEnd`, `onDrop` …), as
// plain functions over what they need, so the canvas component only wires them up.
import { pseudoOf, scopeWithin, stateById } from '@nautink/editors/state/scopes';

import { canConnect, connect, deleteSelection } from './state-actions.ts';
import { addItem, addState } from './state-add.ts';
import { scopeAt, stateGeometry } from './state-geometry.ts';
import { draggedPositions } from './state-move.ts';
import { applyEdgeSelection, applyNodeSelection } from './state-selection.ts';
import { isPaletteKind, NO_SELECTION, STATE_DRAG_TYPE } from './state-types.ts';

import type { StateActionContext } from './state-actions.ts';
import type { Spot } from './state-add.ts';
import type { StateGeometry } from './state-geometry.ts';
import type { NodeMove } from './state-move.ts';
import type { StateCanvasEdge, StateCanvasNode, StateSelection } from './state-types.ts';
import type { Frame } from '@nautink/editors/state/layout';
import type { StateModel } from '@nautink/editors/state/types';
import type { Point } from '@nautink/visual-core/geometry';
import type {
  Connection,
  EdgeChange,
  FinalConnectionState,
  InternalNode,
  NodeChange,
} from '@xyflow/react';
import type { DragEvent, SetStateAction } from 'react';

export interface StateHandlerDeps {
  context: StateActionContext;
  selection: StateSelection;
  setSelection: (update: SetStateAction<StateSelection>) => void;
  setEditingId: (id: string | null) => void;
  setFocusEdgeLabel: (isFocused: boolean) => void;
  isReadOnly: boolean;
  /** Screen pixels → canvas coordinates (`useReactFlow().screenToFlowPosition`). */
  toCanvas: (point: Point) => Point;
}

function geometryOf(context: StateActionContext, model: StateModel): StateGeometry {
  return stateGeometry(model, context.positions.get());
}

function compositeFrameIds(geometry: StateGeometry): Set<string> {
  return new Set<string>(
    geometry.frames
      .filter((frame: Frame) => frame.kind === 'composite')
      .map((frame: Frame) => frame.id),
  );
}

function movesOf(changes: readonly NodeChange[]): NodeMove[] {
  return changes.flatMap((change: NodeChange): NodeMove[] =>
    change.type === 'position' && change.position !== undefined
      ? [{ id: change.id, position: change.position }]
      : [],
  );
}

/** Selection and moves from React Flow. Removals are handled by `onDelete`. */
export function onNodesChange(
  deps: StateHandlerDeps,
  changes: NodeChange<StateCanvasNode>[],
): void {
  const model: StateModel | null = deps.context.getModel();
  if (model === null) {
    return;
  }
  const moves: NodeMove[] = movesOf(changes);
  if (moves.length > 0) {
    deps.context.positions.replace(draggedPositions(model, deps.context.positions.get(), moves));
  }
  const frameIds: Set<string> = compositeFrameIds(geometryOf(deps.context, model));
  deps.setSelection((current) => applyNodeSelection(changes, current, frameIds));
}

export function onEdgesChange(
  deps: StateHandlerDeps,
  changes: EdgeChange<StateCanvasEdge>[],
): void {
  deps.setSelection((current) => applyEdgeSelection(changes, current));
}

/** Delete or Backspace: states (with what is inside), notes, [*] and transitions, as one step. */
export function onDelete(
  deps: StateHandlerDeps,
  { nodes, edges }: { nodes: StateCanvasNode[]; edges: StateCanvasEdge[] },
): void {
  const model: StateModel | null = deps.context.getModel();
  const frameIds: Set<string> =
    model === null ? new Set<string>() : compositeFrameIds(geometryOf(deps.context, model));
  const leaves: StateCanvasNode[] = nodes.filter(
    (node) => node.type !== 'region' && !frameIds.has(node.id),
  );
  deleteSelection(deps.context, {
    nodes: leaves.map((node) => node.id),
    edges: edges.filter((edge) => !edge.id.startsWith('nl:')).map((edge) => edge.id),
    group: nodes.find((node) => frameIds.has(node.id))?.id ?? null,
  });
}

export function isValidConnection(
  context: StateActionContext,
  { source, target }: { source: string; target: string },
): boolean {
  return canConnect(context.getModel(), source, target);
}

export function onConnect(deps: StateHandlerDeps, { source, target }: Connection): void {
  connect(deps.context, source, target);
}

function pointOf(event: MouseEvent | TouchEvent): Point {
  const touch: Touch | undefined = 'changedTouches' in event ? event.changedTouches[0] : undefined;
  if (touch !== undefined) {
    return { x: touch.clientX, y: touch.clientY };
  }
  return 'clientX' in event ? { x: event.clientX, y: event.clientY } : { x: 0, y: 0 };
}

/** The scope a state drawn from `from` goes into: where it was dropped, kept inside a [*]'s scope. */
function droppedScope(
  model: StateModel,
  geometry: StateGeometry,
  request: { from: string; at: Point },
): string | null {
  const scope: string | null = scopeAt(geometry, request.at);
  const home: string | null = pseudoOf(request.from)?.scope ?? null;
  return home !== null && !scopeWithin(model, scope, home) ? home : scope;
}

/** A transition dropped on empty canvas makes a connected state there (v1). */
export function onConnectEnd(
  deps: StateHandlerDeps,
  event: MouseEvent | TouchEvent,
  state: FinalConnectionState<InternalNode>,
): void {
  const model: StateModel | null = deps.context.getModel();
  const from: string | undefined = state.fromNode?.id;
  const isOnEmptyCanvas: boolean = state.isValid !== true && state.toNode === null;
  if (model === null || from === undefined || !isOnEmptyCanvas) {
    return;
  }
  if (pseudoOf(from) === null && stateById(model, from) === undefined) {
    return;
  }
  const at: Point = deps.toCanvas(pointOf(event));
  const scope: string | null = droppedScope(model, geometryOf(deps.context, model), { from, at });
  addState(deps.context, { type: 'state', at, scope, connectFrom: from });
}

/** Double-click renames a plain state, a composite's title or a note (v1). */
export function onNodeDoubleClick(deps: StateHandlerDeps, node: StateCanvasNode): void {
  const model: StateModel | null = deps.context.getModel();
  const isNamed: boolean =
    model !== null &&
    (model.notes.some((note) => note.id === node.id) ||
      stateById(model, node.id)?.type === 'state');
  if (isNamed && !deps.isReadOnly) {
    deps.setEditingId(node.id);
  }
}

/** Double-clicking a transition selects it and opens the inspector with its label focused (v1). */
export function onEdgeDoubleClick(deps: StateHandlerDeps, edge: StateCanvasEdge): void {
  if (!edge.id.startsWith('nl:')) {
    deps.setSelection({ ...NO_SELECTION, edges: [edge.id] });
    deps.setFocusEdgeLabel(true);
  }
}

export function onPaneClick(deps: StateHandlerDeps): void {
  deps.setSelection((current) => ({ ...current, group: null }));
  deps.setEditingId(null);
}

/** A toolbar tool dropped on the canvas: added there, inside the scope under the drop. */
export function onDrop(deps: StateHandlerDeps, event: DragEvent<HTMLElement>): void {
  const kind: string = event.dataTransfer.getData(STATE_DRAG_TYPE);
  const model: StateModel | null = deps.context.getModel();
  if (!isPaletteKind(kind)) {
    return;
  }
  event.preventDefault();
  if (deps.isReadOnly || model === null) {
    return;
  }
  const at: Point = deps.toCanvas({ x: event.clientX, y: event.clientY });
  const spot: Spot = { at, scope: scopeAt(geometryOf(deps.context, model), at) };
  addItem(deps.context, { kind, spot, selection: deps.selection, isDropped: true });
}

/** Lets the canvas accept a drop of our tools (and nothing else). */
export function onDragOver(event: DragEvent<HTMLElement>): void {
  if (event.dataTransfer.types.includes(STATE_DRAG_TYPE)) {
    event.preventDefault();
  }
}
