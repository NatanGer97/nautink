import type { FlowNode } from '@nautink/editors/flow/model';
import type { Edge, Node } from '@xyflow/react';

/** A shape (or icon, or image) node on the canvas. */
export interface ShapeNodeData extends Record<string, unknown> {
  node: FlowNode;
}

/** A subgraph's frame, drawn around its members. */
export interface GroupNodeData extends Record<string, unknown> {
  title: string;
  width: number;
  height: number;
}

export type ShapeFlowNode = Node<ShapeNodeData, 'shape'>;
export type GroupFlowNode = Node<GroupNodeData, 'subgraph'>;
export type FlowCanvasNode = ShapeFlowNode | GroupFlowNode;
export type FlowCanvasEdge = Edge;

/** What is selected on the flowchart canvas. Groups are selected one at a time. */
export interface FlowSelection {
  nodes: readonly string[];
  edges: readonly string[];
  group: string | null;
}

export const NO_SELECTION: FlowSelection = { nodes: [], edges: [], group: null };
