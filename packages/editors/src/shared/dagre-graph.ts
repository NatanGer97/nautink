import { Graph, layout } from '@dagrejs/dagre';

import type { EdgeLabel, GraphLabel, NodeLabel } from '@dagrejs/dagre';
import type { Point, Size } from '@nautink/visual-core/geometry';

const HALF: number = 0.5;

export type LayoutGraph = Graph<GraphLabel, NodeLabel, EdgeLabel>;

export interface LayoutGraphOptions {
  graph: GraphLabel;
  isCompound?: boolean;
  isMultigraph?: boolean;
}

/** A dagre graph whose edges default to an empty label, as every v1 layout set it up. */
export function createLayoutGraph({
  graph,
  isCompound = false,
  isMultigraph = false,
}: LayoutGraphOptions): LayoutGraph {
  const created: LayoutGraph = new Graph<GraphLabel, NodeLabel, EdgeLabel>({
    compound: isCompound,
    multigraph: isMultigraph,
  });
  created.setGraph(graph);
  created.setDefaultEdgeLabel(() => ({}));
  return created;
}

/** A dagre node label for a box of `size`. */
export function sizeLabel(size: Size): NodeLabel {
  return { width: size.width, height: size.height };
}

/** Makes each child a member of its parent cluster, when both are in the graph. */
export function setParents(graph: LayoutGraph, parents: ReadonlyMap<string, string>): void {
  for (const [child, parent] of parents) {
    if (graph.hasNode(child) && graph.hasNode(parent)) {
      graph.setParent(child, parent);
    }
  }
}

/** Runs dagre's layout in place. */
export function runLayout(graph: LayoutGraph): void {
  layout(graph);
}

/** Top-left corner of a laid-out node (dagre reports centres). */
export function topLeftOf(graph: LayoutGraph, id: string): Point {
  const node: NodeLabel = graph.node(id);
  return { x: (node.x ?? 0) - node.width * HALF, y: (node.y ?? 0) - node.height * HALF };
}
