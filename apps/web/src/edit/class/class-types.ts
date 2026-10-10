import type { ClassStyle } from '@nautink/editors/class/styles';
import type { ClassItem, ClassLine, ClassMark, ClassNote } from '@nautink/editors/class/types';
import type { Size } from '@nautink/visual-core/geometry';
import type { Edge, Node } from '@xyflow/react';

/** A class box. `size` comes from `classSize`, so the box and the layout agree. */
export interface ClassNodeData extends Record<string, unknown> {
  item: ClassItem;
  size: Size;
  /** Colors from `style`, `classDef` and `:::` (custom properties), or undefined. */
  style: ClassStyle | undefined;
}

export interface NoteNodeData extends Record<string, unknown> {
  note: ClassNote;
  size: Size;
}

/** A lollipop interface's circle: its free label. */
export interface LolliNodeData extends Record<string, unknown> {
  label: string;
}

/** A namespace's frame, drawn around its content. */
export interface FrameNodeData extends Record<string, unknown> {
  title: string;
  width: number;
  height: number;
}

export type ClassFlowNode = Node<ClassNodeData, 'cls'>;
export type NoteFlowNode = Node<NoteNodeData, 'note'>;
export type LolliFlowNode = Node<LolliNodeData, 'lolli'>;
export type FrameFlowNode = Node<FrameNodeData, 'nsframe'>;
export type ClassCanvasNode = ClassFlowNode | NoteFlowNode | LolliFlowNode | FrameFlowNode;

/** A relation as the canvas draws it. Offsets fan out several links on one side of a box. */
export interface UmlEdgeData extends Record<string, unknown> {
  t1: ClassMark;
  t2: ClassMark;
  line: ClassLine;
  label: string;
  m1: string;
  m2: string;
  isSelf: boolean;
  sourceOffset: number;
  targetOffset: number;
}

export type UmlFlowEdge = Edge<UmlEdgeData, 'uml'>;
export type NoteLinkEdge = Edge<Record<string, never>, 'notelink'>;
export type ClassCanvasEdge = UmlFlowEdge | NoteLinkEdge;

/** What is selected: canvas items (classes, notes, lollipops), relations, one namespace. */
export interface ClassSelection {
  nodes: readonly string[];
  edges: readonly string[];
  group: string | null;
}

export const NO_SELECTION: ClassSelection = { nodes: [], edges: [], group: null };

/** What is being edited in place on the canvas: a class name, a member or a note. */
export type ClassEditing =
  { id: string; part: 'name' | 'note' } | { id: string; part: 'attrs' | 'methods'; index: number };

/** Canvas id prefix of a namespace frame. */
export const FRAME_PREFIX: string = 'ns:';

/** Canvas id prefix of a note's dashed link to its class. */
export const NOTE_LINK_PREFIX: string = 'link:';
