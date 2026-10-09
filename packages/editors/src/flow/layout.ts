// Canvas placement for the flowchart editor: full dagre layout, and placing new nodes next to a
// neighbour after an outside change so known nodes keep their spot.
import { findFreeSpot, overlaps } from '@nautink/visual-core/geometry';

import { nodeSize } from './size.ts';
import {
  createLayoutGraph,
  runLayout,
  setParents,
  sizeLabel,
  topLeftOf,
} from '../shared/dagre-graph.ts';
import { positionOf, rectAt } from '../shared/positions.ts';
import { parentMap } from '../shared/subgraphs.ts';

import type { FlowEdge, FlowGraph, FlowNode, FlowSubgraph } from './model.ts';
import type { LayoutGraph } from '../shared/dagre-graph.ts';
import type { Placement } from '../shared/positions.ts';
import type { GraphLabel } from '@dagrejs/dagre';
import type { Point, Rect, Size } from '@nautink/visual-core/geometry';
import type { Position, PositionMap } from '@nautink/visual-core/positions';

const HALF: number = 0.5;
const GAP: number = 16;
const SPOT_STEP: number = 30;
const RANK_GAP: number = 70;
const CROSS_GAP: number = 90;
const NEXT_TO_ALL: number = 80;
const NUDGE: number = 24;
const MAX_NUDGES: number = 30;
const KNOWN_SHARE: number = 0.5;

/** Nodes drawn as boxes: every node that is not also a subgraph. */
function visibleNodes(graph: FlowGraph): FlowNode[] {
  const groups: Set<string> = new Set<string>(
    graph.subgraphs.map((subgraph: FlowSubgraph) => subgraph.id),
  );
  return graph.nodes.filter((node: FlowNode) => !groups.has(node.id));
}

function addEdges(layout: LayoutGraph, graph: FlowGraph): void {
  const groups: Set<string> = new Set<string>(
    graph.subgraphs.map((subgraph: FlowSubgraph) => subgraph.id),
  );
  for (const edge of graph.edges) {
    const isBetweenNodes: boolean = !groups.has(edge.source) && !groups.has(edge.target);
    if (isBetweenNodes && layout.hasNode(edge.source) && layout.hasNode(edge.target)) {
      layout.setEdge(edge.source, edge.target);
    }
  }
}

function buildLayout(graph: FlowGraph, nodes: readonly FlowNode[]): LayoutGraph {
  const rankdir: GraphLabel['rankdir'] = graph.direction === 'TD' ? 'TB' : graph.direction;
  const layout: LayoutGraph = createLayoutGraph({
    graph: { rankdir, nodesep: 50, ranksep: 70, marginx: 20, marginy: 20 },
    isCompound: true,
  });
  for (const node of nodes) {
    layout.setNode(node.id, sizeLabel(nodeSize(node)));
  }
  for (const subgraph of graph.subgraphs) {
    layout.setNode(subgraph.id, { width: 0, height: 0, paddingTop: 30 });
  }
  setParents(layout, parentMap(graph.subgraphs));
  addEdges(layout, graph);
  return layout;
}

/** Full automatic layout: top-left positions keyed by node id. */
export function dagreLayout(graph: FlowGraph): PositionMap {
  const nodes: FlowNode[] = visibleNodes(graph);
  const layout: LayoutGraph = buildLayout(graph, nodes);
  runLayout(layout);
  return Object.fromEntries(nodes.map((node: FlowNode) => [node.id, topLeftOf(layout, node.id)]));
}

function nodeRects(graph: FlowGraph, positions: PositionMap, skipId: string = ''): Rect[] {
  const byId: Map<string, FlowNode> = new Map<string, FlowNode>(
    graph.nodes.map((node: FlowNode) => [node.id, node]),
  );
  return Object.entries(positions).flatMap(([id, position]: [string, Position]) => {
    const node: FlowNode | undefined = byId.get(id);
    return node && id !== skipId ? [rectAt(position, nodeSize(node))] : [];
  });
}

function nextTo(direction: string, anchor: Rect, size: Size): Point {
  const centerX: number = anchor.x + anchor.w * HALF - size.width * HALF;
  const centerY: number = anchor.y + anchor.h * HALF - size.height * HALF;
  const below: Point = { x: centerX, y: anchor.y + anchor.h + RANK_GAP };
  const spots: Readonly<Record<string, Point>> = {
    BT: { x: centerX, y: anchor.y - size.height - RANK_GAP },
    LR: { x: anchor.x + anchor.w + CROSS_GAP, y: centerY },
    RL: { x: anchor.x - size.width - CROSS_GAP, y: centerY },
  };
  return spots[direction] ?? below;
}

export interface PlaceNearRequest {
  graph: FlowGraph;
  positions: PositionMap;
  node: FlowNode;
  anchorId?: string | null;
}

function anchorRect({ graph, positions, anchorId }: PlaceNearRequest): Rect | undefined {
  const position: Position | undefined = anchorId ? positionOf(positions, anchorId) : undefined;
  const anchor: FlowNode | undefined = graph.nodes.find((node: FlowNode) => node.id === anchorId);
  return position && anchor ? rectAt(position, nodeSize(anchor)) : undefined;
}

function startSpot(request: PlaceNearRequest, others: readonly Rect[], size: Size): Point {
  const anchor: Rect | undefined = anchorRect(request);
  if (anchor) {
    return nextTo(request.graph.direction, anchor, size);
  }
  if (others.length === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.max(...others.map((rect: Rect) => rect.x + rect.w)) + NEXT_TO_ALL,
    y: Math.min(...others.map((rect: Rect) => rect.y)),
  };
}

/** A spot for `node` next to its anchor in the flow direction, nudged until it overlaps nothing. */
export function placeNear(request: PlaceNearRequest): Point {
  const others: Rect[] = nodeRects(request.graph, request.positions, request.node.id);
  const size: Size = nodeSize(request.node);
  const isHorizontal: boolean =
    request.graph.direction === 'LR' || request.graph.direction === 'RL';
  let spot: Point = startSpot(request, others, size);
  for (let step: number = 0; step < MAX_NUDGES; step++) {
    const rect: Rect = rectAt(spot, size);
    if (!others.some((other: Rect) => overlaps(rect, other, GAP))) {
      break;
    }
    spot = isHorizontal
      ? { ...spot, y: spot.y + size.height + NUDGE }
      : { ...spot, x: spot.x + size.width + NUDGE };
  }
  return spot;
}

export interface FreeSpotRequest {
  graph: FlowGraph;
  positions: PositionMap;
  size: Size;
  start: Point;
}

/** The nearest free spot to `start` (top-left), searching outward in rings. */
export function freeSpot({ graph, positions, size, start }: FreeSpotRequest): Point {
  return findFreeSpot({
    rects: nodeRects(graph, positions),
    size,
    start,
    gap: GAP,
    step: SPOT_STEP,
  });
}

/**
 * Remembers each node's label next to its position, so a reused id with a new meaning (a fresh
 * diagram from Claude) is not pinned to an old spot.
 */
export function tagLabels(graph: FlowGraph, positions: PositionMap): PositionMap {
  const tagged: PositionMap = { ...positions };
  for (const node of graph.nodes) {
    const position: Position | undefined = positionOf(tagged, node.id);
    if (position) {
      tagged[node.id] = { ...position, l: node.label };
    }
  }
  return tagged;
}

function isKnown(positions: PositionMap, node: FlowNode): boolean {
  const position: Position | undefined = positionOf(positions, node.id);
  return position !== undefined && (position.l === undefined || position.l === node.label);
}

function anchorOf(graph: FlowGraph, positions: PositionMap, id: string): string | null {
  const incoming: FlowEdge | undefined = graph.edges.find(
    (edge: FlowEdge) => edge.target === id && positionOf(positions, edge.source),
  );
  if (incoming) {
    return incoming.source;
  }
  const outgoing: FlowEdge | undefined = graph.edges.find(
    (edge: FlowEdge) => edge.source === id && positionOf(positions, edge.target),
  );
  return outgoing ? outgoing.target : null;
}

function placeUnknown(
  graph: FlowGraph,
  positions: PositionMap,
  unknown: readonly FlowNode[],
): PositionMap {
  const unknownIds: Set<string> = new Set<string>(unknown.map((node: FlowNode) => node.id));
  const placed: PositionMap = Object.fromEntries(
    Object.entries(positions).filter(([id]: [string, Position]) => !unknownIds.has(id)),
  );
  for (const node of unknown) {
    const anchorId: string | null = anchorOf(graph, placed, node.id);
    placed[node.id] = placeNear({ graph, positions: placed, node, anchorId });
  }
  return placed;
}

/**
 * Positions after the graph changed from outside (code edit, Claude): known nodes keep their spot,
 * new ones go next to a linked neighbour. Lays everything out again when most nodes are unknown.
 */
export function placeNodes(graph: FlowGraph, positions: PositionMap): Placement {
  const nodes: FlowNode[] = visibleNodes(graph);
  const unknown: FlowNode[] = nodes.filter((node: FlowNode) => !isKnown(positions, node));
  const isMostlyUnknown: boolean = nodes.length - unknown.length < nodes.length * KNOWN_SHARE;
  if (nodes.length > 0 && isMostlyUnknown) {
    return { positions: tagLabels(graph, dagreLayout(graph)), isFullLayout: true };
  }
  return {
    positions: tagLabels(graph, placeUnknown(graph, positions, unknown)),
    isFullLayout: false,
  };
}
