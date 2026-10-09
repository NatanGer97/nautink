// Graph + positions → React Flow nodes and edges, as v1's FlowEditor built them: group frames
// around their members, and links that attach to the facing sides of their two boxes.
import { nodeSize } from '@nautink/editors/flow/size';
import { parentMap } from '@nautink/editors/shared/subgraphs';
import { MarkerType } from '@xyflow/react';

import { CIRCLE_MARKER, CROSS_MARKER } from './flow-markers.tsx';

import type {
  FlowCanvasEdge,
  FlowCanvasNode,
  FlowSelection,
  GroupFlowNode,
  ShapeFlowNode,
} from './flow-types.ts';
import type {
  FlowArrow,
  FlowEdge,
  FlowGraph,
  FlowNode,
  FlowSubgraph,
} from '@nautink/editors/flow/model';
import type { Rect, Size } from '@nautink/visual-core/geometry';
import type { Position, PositionMap } from '@nautink/visual-core/positions';
import type { EdgeMarker } from '@xyflow/react';

const GROUP_PAD: number = 22;
const GROUP_TITLE: number = 24;
const GROUP_Z: number = -10;
const NODE_Z: number = 1;
const EDGE_Z: number = 2;
const ARROW_SIZE: number = 16;
const HALF: number = 0.5;
const ORIGIN: Position = { x: 0, y: 0 };

/** Nodes drawn as boxes: every node that is not also a subgraph. */
export function visibleNodes(graph: FlowGraph): FlowNode[] {
  const groups: Set<string> = new Set<string>(graph.subgraphs.map((subgraph) => subgraph.id));
  return graph.nodes.filter((node) => !groups.has(node.id));
}

function positionOf(positions: PositionMap, id: string): Position {
  return (Object.hasOwn(positions, id) ? positions[id] : undefined) ?? ORIGIN;
}

function groupBox(subgraph: FlowSubgraph, boxes: ReadonlyMap<string, Rect>): Rect | undefined {
  const inner: Rect[] = subgraph.members.flatMap((id) => {
    const box: Rect | undefined = boxes.get(id);
    return box === undefined ? [] : [box];
  });
  if (inner.length === 0) {
    return undefined;
  }
  const x: number = Math.min(...inner.map((box) => box.x)) - GROUP_PAD;
  const y: number = Math.min(...inner.map((box) => box.y)) - GROUP_PAD - GROUP_TITLE;
  const right: number = Math.max(...inner.map((box) => box.x + box.w)) + GROUP_PAD;
  const bottom: number = Math.max(...inner.map((box) => box.y + box.h)) + GROUP_PAD;
  return { x, y, w: right - x, h: bottom - y };
}

/** The box of every node and subgraph. Inner subgraphs come first, so outer frames wrap them. */
export function flowBoxes(graph: FlowGraph, positions: PositionMap): Map<string, Rect> {
  const boxes: Map<string, Rect> = new Map<string, Rect>();
  for (const node of visibleNodes(graph)) {
    const size: Size = nodeSize(node);
    const { x, y } = positionOf(positions, node.id);
    boxes.set(node.id, { x, y, w: size.width, h: size.height });
  }
  for (const subgraph of graph.subgraphs) {
    const box: Rect | undefined = groupBox(subgraph, boxes);
    if (box !== undefined) {
      boxes.set(subgraph.id, box);
    }
  }
  return boxes;
}

function shapeNode(node: FlowNode, position: Position, isSelected: boolean): ShapeFlowNode {
  const size: Size = nodeSize(node);
  return {
    id: node.id,
    type: 'shape',
    position: { x: position.x, y: position.y },
    data: { node },
    selected: isSelected,
    zIndex: NODE_Z,
    width: size.width,
    height: size.height,
    // The size is known from the label, so React Flow can place the node before measuring it.
    measured: { ...size },
  };
}

function depthOf(id: string, parent: ReadonlyMap<string, string>): number {
  const above: string | undefined = parent.get(id);
  return above === undefined ? 0 : 1 + depthOf(above, parent);
}

function groupNode(subgraph: FlowSubgraph, box: Rect, depth: number): GroupFlowNode {
  return {
    id: subgraph.id,
    type: 'subgraph',
    position: { x: box.x, y: box.y },
    data: { title: subgraph.title, width: box.w, height: box.h },
    draggable: false,
    selected: false,
    zIndex: GROUP_Z + depth,
    width: box.w,
    height: box.h,
    measured: { width: box.w, height: box.h },
  };
}

function groupNodes(
  graph: FlowGraph,
  boxes: ReadonlyMap<string, Rect>,
  selected: string | null,
): GroupFlowNode[] {
  const parent: Map<string, string> = parentMap(graph.subgraphs);
  return graph.subgraphs.flatMap((subgraph): GroupFlowNode[] => {
    const box: Rect | undefined = boxes.get(subgraph.id);
    return box === undefined
      ? []
      : [
          {
            ...groupNode(subgraph, box, depthOf(subgraph.id, parent)),
            selected: selected === subgraph.id,
          },
        ];
  });
}

/** Group frames first (underneath), then the shape nodes. */
export function flowNodes(
  graph: FlowGraph,
  positions: PositionMap,
  selection: FlowSelection,
): FlowCanvasNode[] {
  const selected: Set<string> = new Set<string>(selection.nodes);
  const boxes: Map<string, Rect> = flowBoxes(graph, positions);
  return [
    ...groupNodes(graph, boxes, selection.group),
    ...visibleNodes(graph).map((node) =>
      shapeNode(node, positionOf(positions, node.id), selected.has(node.id)),
    ),
  ];
}

/** The facing sides of two boxes (handle ids t/r/b/l), so links attach sensibly wherever nodes go. */
export function handlesFor(a: Rect, b: Rect): [string, string] {
  const dx: number = b.x + b.w * HALF - (a.x + a.w * HALF);
  const dy: number = b.y + b.h * HALF - (a.y + a.h * HALF);
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? ['r', 'l'] : ['l', 'r'];
  }
  return dy > 0 ? ['b', 't'] : ['t', 'b'];
}

const MARKERS: Readonly<Record<FlowArrow, EdgeMarker | string | undefined>> = {
  point: {
    type: MarkerType.ArrowClosed,
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    color: 'var(--edge)',
  },
  open: undefined,
  circle: CIRCLE_MARKER,
  cross: CROSS_MARKER,
};

function canvasEdge(edge: FlowEdge, ends: [Rect, Rect], isSelected: boolean): FlowCanvasEdge {
  const [sourceHandle, targetHandle] = handlesFor(...ends);
  const marker: EdgeMarker | string | undefined = MARKERS[edge.arrow];
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle,
    targetHandle,
    ...(edge.label === '' ? {} : { label: edge.label.replace(/<br\s*\/?>/gi, ' ') }),
    ...(marker === undefined ? {} : { markerEnd: marker }),
    selected: isSelected,
    zIndex: EDGE_Z,
    className: `flow-edge-${edge.stroke}`,
  };
}

/** The links whose two ends are on the canvas. */
export function flowEdges(
  graph: FlowGraph,
  positions: PositionMap,
  selection: FlowSelection,
): FlowCanvasEdge[] {
  const boxes: Map<string, Rect> = flowBoxes(graph, positions);
  const selected: Set<string> = new Set<string>(selection.edges);
  return graph.edges.flatMap((edge) => {
    const source: Rect | undefined = boxes.get(edge.source);
    const target: Rect | undefined = boxes.get(edge.target);
    return source === undefined || target === undefined
      ? []
      : [canvasEdge(edge, [source, target], selected.has(edge.id))];
  });
}
