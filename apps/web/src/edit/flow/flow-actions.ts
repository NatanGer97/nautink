// Every flowchart edit as a labelled undo step (v1's FlowEditor `actions`, `addShape`, `onConnect`,
// `onDelete`). Pure of React: each action reads the newest graph and positions when it runs.
import { dagreLayout, freeSpot } from '@nautink/editors/flow/layout';
import { SHAPE_BY_ID } from '@nautink/editors/flow/library';
import { uniqueId } from '@nautink/editors/flow/model';
import * as ops from '@nautink/editors/flow/ops';
import { nodeSize } from '@nautink/editors/flow/size';
import { parentMap } from '@nautink/editors/shared/subgraphs';
import { deleteLabel, editLabel } from '@nautink/visual-core/labels';
import { clip } from '@nautink/visual-core/text';

import { edgeName, nodeName } from './flow-names.ts';
import { NO_SELECTION } from './flow-types.ts';
import { iconCaption } from '../library/icon-library.tsx';

import type { FlowSelection } from './flow-types.ts';
import type {
  FlowDirection,
  FlowEdge,
  FlowGraph,
  FlowNode,
  FlowSubgraph,
} from '@nautink/editors/flow/model';
import type { Point, Size } from '@nautink/visual-core/geometry';
import type { PositionMap } from '@nautink/visual-core/positions';

/** A shape from the toolbar or library, or an icon with its frame. */
export type NewShape = { shape: string } | { icon: string; form: string };

export interface FlowActionContext {
  getGraph: () => FlowGraph | null;
  commit: (next: FlowGraph, label: string) => void;
  positions: {
    get: () => PositionMap;
    set: (id: string, point: Point) => void;
    replace: (positions: PositionMap) => void;
  };
  select: (selection: FlowSelection) => void;
  setEditingId: (id: string | null) => void;
  requestFit: () => void;
}

const NAME_CLIP: number = 28;
const ICON_BOX: number = 48;
const HALF: number = 0.5;
/** A duplicate lands this far right and down of its original. */
export const DUPLICATE_OFFSET: number = 24;

/** The node a library pick makes: a shape named after itself, or an icon labelled from its name. */
export function newNode(spec: NewShape, id: string): FlowNode {
  if ('icon' in spec) {
    const label: string = iconCaption(spec.icon);
    return {
      id,
      shape: 'rect',
      icon: spec.icon,
      form: spec.form,
      pos: 'b',
      h: ICON_BOX,
      label,
      classes: [],
    };
  }
  return { id, shape: spec.shape, label: SHAPE_BY_ID.get(spec.shape)?.name ?? 'Node', classes: [] };
}

function centeredAt(at: Point, size: Size): Point {
  return { x: at.x - size.width * HALF, y: at.y - size.height * HALF };
}

export interface AddShapeRequest {
  spec: NewShape;
  /** Where the shape's centre should go, in canvas coordinates. */
  at: Point;
  /** A link drawn from this node and dropped on empty canvas makes the new node. */
  connectFrom?: string;
}

function addedGraph(graph: FlowGraph, node: FlowNode, connectFrom: string | undefined): FlowGraph {
  if (connectFrom === undefined) {
    return ops.addNode(graph, node);
  }
  const group: string | null = parentMap(graph.subgraphs).get(connectFrom) ?? null;
  return ops.addEdge(ops.addNode(graph, node, group), { source: connectFrom, target: node.id });
}

/** Adds a node (and selects it for renaming), next to free space unless a link placed it. */
export function addShape(context: FlowActionContext, request: AddShapeRequest): void {
  const graph: FlowGraph | null = context.getGraph();
  if (graph === null) {
    return;
  }
  const node: FlowNode = newNode(request.spec, uniqueId(graph));
  const size: Size = nodeSize(node);
  const start: Point = centeredAt(request.at, size);
  const positions: PositionMap = context.positions.get();
  const isLinked: boolean = request.connectFrom !== undefined;
  context.positions.set(node.id, isLinked ? start : freeSpot({ graph, positions, size, start }));
  const after: string = isLinked ? ` after ${nodeName(graph, request.connectFrom ?? '')}` : '';
  context.commit(
    addedGraph(graph, node, request.connectFrom),
    `Added node ${clip(node.label, NAME_CLIP)}${after}`,
  );
  context.select({ ...NO_SELECTION, nodes: [node.id] });
  context.setEditingId(node.id);
}

type Edit = (graph: FlowGraph) => [FlowGraph, string];

/** Runs one edit on the newest graph and commits it with its label. */
function run(context: FlowActionContext, edit: Edit): void {
  const graph: FlowGraph | null = context.getGraph();
  if (graph !== null) {
    const [next, label] = edit(graph);
    context.commit(next, label);
  }
}

export function updateNode(context: FlowActionContext, id: string, patch: Partial<FlowNode>): void {
  run(context, (g) => [ops.updateNode(g, id, patch), editLabel('node', nodeName(g, id), patch)]);
}

export function updateEdge(context: FlowActionContext, id: string, patch: Partial<FlowEdge>): void {
  run(context, (g) => [ops.updateEdge(g, id, patch), editLabel('link', edgeName(g, id), patch)]);
}

export function updateGroup(
  context: FlowActionContext,
  id: string,
  patch: Partial<FlowSubgraph>,
): void {
  run(context, (g) => [ops.updateGroup(g, id, patch), editLabel('group', nodeName(g, id), patch)]);
}

export function reverseEdge(context: FlowActionContext, id: string): void {
  run(context, (g) => [ops.reverseEdge(g, id), `Reversed link ${edgeName(g, id)}`]);
}

/** Renames from the inline editor; nothing is recorded when the label did not change. */
export function renameNode(context: FlowActionContext, id: string, label: string): void {
  const node: FlowNode | undefined = context.getGraph()?.nodes.find((item) => item.id === id);
  if (node !== undefined && node.label !== label) {
    updateNode(context, id, { label });
  }
}

/** Links two nodes (dragged from a handle onto another node). */
export function connect(context: FlowActionContext, source: string, target: string): void {
  run(context, (g) => [
    ops.addEdge(g, { source, target }),
    `Connected ${nodeName(g, source)} → ${nodeName(g, target)}`,
  ]);
}

/** The names a delete step lists: links that go with their nodes are not counted (v1). */
export function deletedNames(graph: FlowGraph, selection: FlowSelection): string[] {
  const nodes: Set<string> = new Set<string>(selection.nodes);
  const ownLinks: string[] = selection.edges.filter((id) => {
    const edge: FlowEdge | undefined = graph.edges.find((item) => item.id === id);
    return edge !== undefined && !nodes.has(edge.source) && !nodes.has(edge.target);
  });
  return [
    ...selection.nodes.map((id) => nodeName(graph, id)),
    ...ownLinks.map((id) => `link ${edgeName(graph, id)}`),
    ...(selection.group === null ? [] : [nodeName(graph, selection.group)]),
  ];
}

/** Deletes the selection: nodes with their links, links, and a group (keeping its members). */
export function deleteSelection(context: FlowActionContext, selection: FlowSelection): void {
  const isEmpty: boolean =
    selection.nodes.length === 0 && selection.edges.length === 0 && selection.group === null;
  if (isEmpty) {
    return;
  }
  run(context, (g) => [
    ops.deleteItems(g, {
      nodeIds: selection.nodes,
      edgeIds: selection.edges,
      groupIds: selection.group === null ? [] : [selection.group],
    }),
    deleteLabel(deletedNames(g, selection)),
  ]);
  context.select(NO_SELECTION);
}

function placeCopies(context: FlowActionContext, copies: ReadonlyMap<string, string>): void {
  const positions: PositionMap = context.positions.get();
  for (const [original, copy] of copies) {
    const from: Point = (Object.hasOwn(positions, original) ? positions[original] : undefined) ?? {
      x: 0,
      y: 0,
    };
    context.positions.set(copy, { x: from.x + DUPLICATE_OFFSET, y: from.y + DUPLICATE_OFFSET });
  }
}

function duplicatedLabel(graph: FlowGraph, copies: ReadonlyMap<string, string>): string {
  const [first = ''] = copies.keys();
  return copies.size === 1
    ? `Duplicated ${nodeName(graph, first)}`
    : `Duplicated ${String(copies.size)} nodes`;
}

/** Copies the selected nodes next to the originals and selects the copies. */
export function duplicateNodes(context: FlowActionContext, ids: readonly string[]): void {
  const graph: FlowGraph | null = context.getGraph();
  if (graph === null || ids.length === 0) {
    return;
  }
  const { graph: next, copies } = ops.duplicateNodes(graph, ids);
  if (copies.size === 0) {
    return;
  }
  placeCopies(context, copies);
  context.commit(next, duplicatedLabel(graph, copies));
  context.select({ ...NO_SELECTION, nodes: [...copies.values()] });
}

/** Wraps nodes in a new group and selects it. */
export function groupNodes(context: FlowActionContext, ids: readonly string[]): void {
  const graph: FlowGraph | null = context.getGraph();
  if (graph !== null && ids.length > 0) {
    const { graph: next, id } = ops.groupNodes(graph, ids);
    context.commit(next, `Grouped ${String(ids.length)} ${ids.length === 1 ? 'node' : 'nodes'}`);
    context.select({ ...NO_SELECTION, group: id });
  }
}

export function ungroup(context: FlowActionContext, id: string): void {
  run(context, (g) => [ops.ungroup(g, id), `Ungrouped ${nodeName(g, id)}`]);
  context.select(NO_SELECTION);
}

export function setNodeGroup(context: FlowActionContext, id: string, groupId: string | null): void {
  run(context, (g) => [
    ops.setNodeGroup(g, id, groupId),
    groupId === null
      ? `Moved ${nodeName(g, id)} out of its group`
      : `Moved ${nodeName(g, id)} into ${nodeName(g, groupId)}`,
  ]);
}

/** Changes the flow direction and lays the diagram out again in it (v1). */
export function setDirection(context: FlowActionContext, direction: FlowDirection): void {
  const graph: FlowGraph | null = context.getGraph();
  if (graph === null || graph.direction === direction) {
    return;
  }
  const next: FlowGraph = { ...graph, direction };
  context.positions.replace({ ...context.positions.get(), ...dagreLayout(next) });
  context.commit(next, `Changed direction to ${direction}`);
  context.requestFit();
}
