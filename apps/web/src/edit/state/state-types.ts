import type { LeafData } from '@nautink/editors/state/size';
import type { Rect } from '@nautink/visual-core/geometry';
import type { Edge, Node } from '@xyflow/react';

/** A plain state, a pseudo state (start, end, choice, fork, join) or a note: drawn from its leaf data. */
export interface LeafNodeData extends Record<string, unknown> {
  leaf: LeafData;
}

/** A composite's frame (with children), or an empty composite drawn as a box of its own. */
export interface CompositeNodeData extends Record<string, unknown> {
  label: string;
  width: number;
  height: number;
  isEmpty: boolean;
}

/** A concurrent region inside a composite: a dashed box, not selectable. */
export interface RegionNodeData extends Record<string, unknown> {
  width: number;
  height: number;
}

/** One node type for every leaf: React Flow re-measures a node whose type changes (a state made a choice). */
export type StateLeafNode = Node<LeafNodeData, 'leaf'>;
export type CompositeFlowNode = Node<CompositeNodeData, 'composite'>;
export type RegionFlowNode = Node<RegionNodeData, 'region'>;
export type StateCanvasNode = StateLeafNode | CompositeFlowNode | RegionFlowNode;

/** What a transition edge needs to draw a self-loop or a curve offset from its parallels. */
export interface TransitionEdgeData extends Record<string, unknown> {
  isSelf: boolean;
  offset: number;
  isFlipped: boolean;
  box: Rect | null;
}

export type TransitionFlowEdge = Edge<TransitionEdgeData, 'transition'>;
export type StateCanvasEdge = TransitionFlowEdge | Edge;

/**
 * What is selected on the state canvas. `nodes` are leaves (states, pseudo states, notes, empty
 * composites); `group` is a composite selected by its frame, one at a time.
 */
export interface StateSelection {
  nodes: readonly string[];
  edges: readonly string[];
  group: string | null;
}

export const NO_SELECTION: StateSelection = { nodes: [], edges: [], group: null };

/** Kinds the toolbar adds (v1's `PALETTE`). */
export type PaletteKind =
  'state' | 'start' | 'end' | 'choice' | 'fork' | 'join' | 'composite' | 'note';

/** The drag type of a toolbar tool dropped on the canvas; its data is the palette kind. */
export const STATE_DRAG_TYPE: string = 'application/x-nautink-state';

const PALETTE_KINDS: readonly string[] = [
  'state',
  'start',
  'end',
  'choice',
  'fork',
  'join',
  'composite',
  'note',
];

export function isPaletteKind(value: string): value is PaletteKind {
  return PALETTE_KINDS.includes(value);
}
