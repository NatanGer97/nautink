// React Flow's events on the flowchart canvas (v1's `onNodesChange`, `onConnectEnd`, `onDrop` …),
// as plain functions over what they need, so the canvas component only wires them up.
import { addShape, connect, deleteSelection } from './flow-actions.ts';
import { parseIconDrop, SHAPE_DRAG_TYPE } from './flow-drop.ts';
import { applyEdgeChanges, applyNodeSelection, nodeMoves } from './flow-selection.ts';
import { NO_SELECTION } from './flow-types.ts';
import { ICON_DRAG_TYPE } from '../library/icon-library.tsx';

import type { FlowActionContext, NewShape } from './flow-actions.ts';
import type { FlowCanvasEdge, FlowCanvasNode, FlowSelection } from './flow-types.ts';
import type { FlowGraph, FlowNode } from '@nautink/editors/flow/model';
import type { Point } from '@nautink/visual-core/geometry';
import type {
  Connection,
  EdgeChange,
  FinalConnectionState,
  InternalNode,
  NodeChange,
} from '@xyflow/react';
import type { DragEvent, SetStateAction } from 'react';

export interface FlowHandlerDeps {
  context: FlowActionContext;
  setSelection: (update: SetStateAction<FlowSelection>) => void;
  setEditingId: (id: string | null) => void;
  setFocusEdgeLabel: (isFocused: boolean) => void;
  isReadOnly: boolean;
  /** Screen pixels → canvas coordinates (`useReactFlow().screenToFlowPosition`). */
  toCanvas: (point: Point) => Point;
}

function groupIdsOf(graph: FlowGraph | null): Set<string> {
  return new Set<string>((graph?.subgraphs ?? []).map((group) => group.id));
}

/** Shapes a new node drawn from `from` keeps; markers and decisions start a plain process box (v1). */
const NOT_CONTINUED: ReadonlySet<string> = new Set([
  'diam',
  'sm-circ',
  'f-circ',
  'fr-circ',
  'fork',
]);

export function continuedShape(from: FlowNode | undefined): string {
  const isPlain: boolean =
    from === undefined ||
    from.icon !== undefined ||
    from.img !== undefined ||
    NOT_CONTINUED.has(from.shape);
  return isPlain || from === undefined ? 'rect' : from.shape;
}

function pointOf(event: MouseEvent | TouchEvent): Point {
  const touch: Touch | undefined = 'changedTouches' in event ? event.changedTouches[0] : undefined;
  if (touch !== undefined) {
    return { x: touch.clientX, y: touch.clientY };
  }
  return 'clientX' in event ? { x: event.clientX, y: event.clientY } : { x: 0, y: 0 };
}

/** Drag-and-drop from the toolbar and the library: what was dropped, if it is ours. */
export function droppedShape(data: DataTransfer): NewShape | null {
  const shape: string = data.getData(SHAPE_DRAG_TYPE);
  if (shape !== '') {
    return { shape };
  }
  const icon: string = data.getData(ICON_DRAG_TYPE);
  return icon === '' ? null : parseIconDrop(icon);
}

/** Selection and moves from React Flow. Removals are handled by `onDelete`. */
export function onNodesChange(deps: FlowHandlerDeps, changes: NodeChange<FlowCanvasNode>[]): void {
  const groupIds: Set<string> = groupIdsOf(deps.context.getGraph());
  for (const [id, position] of nodeMoves(changes, groupIds)) {
    deps.context.positions.set(id, position);
  }
  deps.setSelection((current) => applyNodeSelection(changes, current, groupIds));
}

export function onEdgesChange(deps: FlowHandlerDeps, changes: EdgeChange<FlowCanvasEdge>[]): void {
  deps.setSelection((current) => applyEdgeChanges(changes, current));
}

/** Delete or Backspace: nodes (with their links), links and a group, as one step. */
export function onDelete(
  deps: FlowHandlerDeps,
  { nodes, edges }: { nodes: FlowCanvasNode[]; edges: FlowCanvasEdge[] },
): void {
  const groups: FlowCanvasNode[] = nodes.filter((node) => node.type === 'subgraph');
  deleteSelection(deps.context, {
    nodes: nodes.filter((node) => node.type === 'shape').map((node) => node.id),
    edges: edges.map((edge) => edge.id),
    group: groups[0]?.id ?? null,
  });
}

export function onConnect(deps: FlowHandlerDeps, { source, target }: Connection): void {
  connect(deps.context, source, target);
}

/** The node a dropped link starts from, when the drop should make a new node there. */
function droppedLinkSource(
  graph: FlowGraph | null,
  state: FinalConnectionState<InternalNode>,
): string | null {
  const fromId: string | undefined = state.fromNode?.id;
  const isOnEmptyCanvas: boolean = state.isValid !== true && fromId !== undefined;
  return isOnEmptyCanvas && graph !== null && !groupIdsOf(graph).has(fromId ?? '')
    ? (fromId ?? null)
    : null;
}

/** A link dropped on empty canvas makes a connected node there (v1). */
export function onConnectEnd(
  deps: FlowHandlerDeps,
  event: MouseEvent | TouchEvent,
  state: FinalConnectionState<InternalNode>,
): void {
  const graph: FlowGraph | null = deps.context.getGraph();
  const fromId: string | null = droppedLinkSource(graph, state);
  if (fromId === null) {
    return;
  }
  const from: FlowNode | undefined = graph?.nodes.find((node) => node.id === fromId);
  addShape(deps.context, {
    spec: { shape: continuedShape(from) },
    at: deps.toCanvas(pointOf(event)),
    connectFrom: fromId,
  });
}

export function onNodeDoubleClick(deps: FlowHandlerDeps, node: FlowCanvasNode): void {
  if (node.type === 'shape' && !deps.isReadOnly) {
    deps.setEditingId(node.id);
  }
}

/** Double-clicking a link selects it and opens the inspector with its label focused (v1). */
export function onEdgeDoubleClick(deps: FlowHandlerDeps, edge: FlowCanvasEdge): void {
  deps.setSelection({ ...NO_SELECTION, edges: [edge.id] });
  deps.setFocusEdgeLabel(true);
}

export function onPaneClick(deps: FlowHandlerDeps): void {
  deps.setSelection((current) => ({ ...current, group: null }));
  deps.setEditingId(null);
}

export function onDrop(deps: FlowHandlerDeps, event: DragEvent<HTMLElement>): void {
  const spec: NewShape | null = droppedShape(event.dataTransfer);
  if (spec === null) {
    return;
  }
  event.preventDefault();
  if (!deps.isReadOnly) {
    addShape(deps.context, { spec, at: deps.toCanvas({ x: event.clientX, y: event.clientY }) });
  }
}

/** Lets the canvas accept a drop of our tiles (and nothing else). */
export function onDragOver(event: DragEvent<HTMLElement>): void {
  const types: readonly string[] = event.dataTransfer.types;
  if (types.includes(SHAPE_DRAG_TYPE) || types.includes(ICON_DRAG_TYPE)) {
    event.preventDefault();
  }
}
