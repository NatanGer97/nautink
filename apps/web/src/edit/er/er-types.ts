import type { ErEntity } from '@nautink/editors/er/model';
import type { Edge, Node } from '@xyflow/react';

/** An entity table on the canvas. */
export interface EntityNodeData extends Record<string, unknown> {
  entity: ErEntity;
}

/** A subgraph's frame, drawn around its members. */
export interface ErGroupNodeData extends Record<string, unknown> {
  title: string;
  width: number;
  height: number;
}

/** A relationship line: its label, its line style and where its ends sit on their sides. */
export interface ErEdgeData extends Record<string, unknown> {
  label: string;
  isIdentifying: boolean;
  isSelf: boolean;
  /** How far each end slides along its side, so links sharing a side do not overlap (v1). */
  sourceShift: number;
  targetShift: number;
}

export type EntityFlowNode = Node<EntityNodeData, 'entity'>;
export type ErGroupFlowNode = Node<ErGroupNodeData, 'subgraph'>;
export type ErCanvasNode = EntityFlowNode | ErGroupFlowNode;
export type ErCanvasEdge = Edge<ErEdgeData, 'relationship'>;

/** What is selected on the ER canvas. Groups are selected one at a time. */
export interface ErCanvasSelection {
  entities: readonly string[];
  rels: readonly string[];
  group: string | null;
}

export const NO_SELECTION: ErCanvasSelection = { entities: [], rels: [], group: null };
