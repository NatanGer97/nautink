// Model + positions → React Flow nodes and edges, as v1's StateEditor built them: composite and
// region frames around what they hold, leaves on top, transitions between facing sides.
import { displayName, stateById } from '@nautink/editors/state/scopes';
import { MarkerType } from '@xyflow/react';

import { boxOf } from './state-geometry.ts';

import type { StateGeometry } from './state-geometry.ts';
import type {
  CompositeFlowNode,
  CompositeNodeData,
  RegionFlowNode,
  StateCanvasEdge,
  StateCanvasNode,
  StateSelection,
  TransitionEdgeData,
  TransitionFlowEdge,
} from './state-types.ts';
import type { Frame, Leaf } from '@nautink/editors/state/layout';
import type {
  StateModel,
  StateNode,
  StateNote,
  StateTransition,
} from '@nautink/editors/state/types';
import type { Rect, Size } from '@nautink/visual-core/geometry';
import type { Edge, EdgeMarker } from '@xyflow/react';

const FRAME_Z: number = -40;
const FRAME_DEPTH_Z: number = 2;
const LEAF_Z: number = 3;
const NOTE_Z: number = 4;
const EDGE_Z: number = 2;
const NOTE_LINK_Z: number = 1;
const HALF: number = 0.5;
const BAR_THICKNESS: number = 12;
const BAR_LENGTH: number = 40;
const ARROW_SIZE: number = 16;

function isSelectedLeaf(selection: StateSelection, id: string): boolean {
  return selection.nodes.includes(id) || selection.group === id;
}

/** Where a node goes and its size: React Flow is told it up front, so nothing waits on measuring. */
interface Placed {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  measured: Size;
}

function placed(id: string, box: Rect): Placed {
  const size: Size = { width: box.w, height: box.h };
  return { id, position: { x: box.x, y: box.y }, ...size, measured: size };
}

function compositeData(label: string, box: Rect, isEmpty: boolean): CompositeNodeData {
  return { label, width: box.w, height: box.h, isEmpty };
}

function compositeFrame(frame: Frame, box: Rect, request: FrameRequest): CompositeFlowNode {
  const state: StateNode | undefined = stateById(request.model, frame.id);
  return {
    ...placed(frame.id, box),
    type: 'composite',
    data: compositeData(state ? displayName(state) : frame.id, box, false),
    selected: request.selection.group === frame.id,
    zIndex: FRAME_Z + frame.depth * FRAME_DEPTH_Z,
  };
}

interface FrameRequest {
  model: StateModel;
  selection: StateSelection;
}

function regionFrame(frame: Frame, box: Rect): RegionFlowNode {
  return {
    ...placed(frame.id, box),
    type: 'region',
    data: { width: box.w, height: box.h },
    selectable: false,
    draggable: false,
    connectable: false,
    deletable: false,
    focusable: false,
    zIndex: FRAME_Z + frame.depth * FRAME_DEPTH_Z,
  };
}

/** Frames outermost first, so inner frames are drawn over outer ones. */
function frameNodes(
  model: StateModel,
  geometry: StateGeometry,
  selection: StateSelection,
): StateCanvasNode[] {
  return [...geometry.frames]
    .sort((a: Frame, b: Frame) => a.depth - b.depth)
    .flatMap((frame: Frame): StateCanvasNode[] => {
      const box: Rect | undefined = boxOf(geometry, frame.id);
      if (box === undefined) {
        return [];
      }
      return [
        frame.kind === 'composite'
          ? compositeFrame(frame, box, { model, selection })
          : regionFrame(frame, box),
      ];
    });
}

function leafNode(leaf: Leaf, box: Rect, isSelected: boolean): StateCanvasNode {
  const shared: Placed & Pick<StateCanvasNode, 'selected'> = {
    ...placed(leaf.id, box),
    selected: isSelected,
  };
  if (leaf.data.kind === 'emptyComposite') {
    const data: CompositeNodeData = compositeData(leaf.data.label, box, true);
    return { ...shared, type: 'composite', zIndex: LEAF_Z, data };
  }
  const isNote: boolean = leaf.data.kind === 'note';
  return {
    ...shared,
    type: 'leaf',
    zIndex: isNote ? NOTE_Z : LEAF_Z,
    data: { leaf: leaf.data },
    ...(isNote ? { connectable: false } : {}),
  };
}

/** Frames first (underneath), then every leaf that has a spot. */
export function stateNodes(
  model: StateModel,
  geometry: StateGeometry,
  selection: StateSelection,
): StateCanvasNode[] {
  return [
    ...frameNodes(model, geometry, selection),
    ...geometry.leaves.flatMap((leaf: Leaf): StateCanvasNode[] => {
      const box: Rect | undefined = boxOf(geometry, leaf.id);
      return box === undefined ? [] : [leafNode(leaf, box, isSelectedLeaf(selection, leaf.id))];
    }),
  ];
}

function isFlatBar(box: Rect): boolean {
  return box.h <= BAR_THICKNESS && box.w > BAR_LENGTH;
}

function isTallBar(box: Rect): boolean {
  return box.w <= BAR_THICKNESS && box.h > BAR_LENGTH;
}

function vertical(from: Rect, to: Rect): string {
  return to.y + to.h * HALF > from.y + from.h * HALF ? 'b' : 't';
}

function horizontal(from: Rect, to: Rect): string {
  return to.x + to.w * HALF > from.x + from.w * HALF ? 'r' : 'l';
}

/** The facing sides of two boxes (handle ids t/r/b/l); fork and join bars use their long sides. */
export function handlesFor(a: Rect, b: Rect): [string, string] {
  if (isFlatBar(a) || isFlatBar(b)) {
    return [vertical(a, b), vertical(b, a)];
  }
  if (isTallBar(a) || isTallBar(b)) {
    return [horizontal(a, b), horizontal(b, a)];
  }
  const dx: number = b.x + b.w * HALF - (a.x + a.w * HALF);
  const dy: number = b.y + b.h * HALF - (a.y + a.h * HALF);
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? ['r', 'l'] : ['l', 'r'];
  }
  return dy > 0 ? ['b', 't'] : ['t', 'b'];
}

function pairKey(transition: StateTransition): string {
  return [transition.from, transition.to].sort().join('\u0000');
}

/** Transitions between the same two items, by pair, so parallel ones can curve apart. */
function parallels(model: StateModel): Map<string, string[]> {
  const pairs: Map<string, string[]> = new Map<string, string[]>();
  for (const transition of model.transitions) {
    pairs.set(pairKey(transition), [...(pairs.get(pairKey(transition)) ?? []), transition.id]);
  }
  return pairs;
}

function arrow(isSelected: boolean): EdgeMarker {
  return {
    type: MarkerType.ArrowClosed,
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    color: isSelected ? 'var(--accent-ink)' : 'var(--edge)',
  };
}

interface EdgeContext {
  geometry: StateGeometry;
  pairs: Map<string, string[]>;
  selected: ReadonlySet<string>;
}

interface LinkEnds {
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

function ends(source: string, target: string, handles: [string, string]): LinkEnds {
  return { source, target, sourceHandle: handles[0], targetHandle: handles[1] };
}

/** A self-loop's box, and how far a transition curves away from its parallels. */
function transitionData(
  context: EdgeContext,
  transition: StateTransition,
  from: Rect,
): TransitionEdgeData {
  const group: string[] = context.pairs.get(pairKey(transition)) ?? [];
  const index: number = group.indexOf(transition.id);
  const isSelf: boolean = transition.from === transition.to;
  return {
    isSelf,
    offset: isSelf ? index : index - (group.length - 1) * HALF,
    isFlipped: transition.from > transition.to,
    box: isSelf ? from : null,
  };
}

function transitionEdge(context: EdgeContext, transition: StateTransition): TransitionFlowEdge[] {
  const from: Rect | undefined = boxOf(context.geometry, transition.from);
  const to: Rect | undefined = boxOf(context.geometry, transition.to);
  if (from === undefined || to === undefined) {
    return [];
  }
  const handles: [string, string] =
    transition.from === transition.to ? ['r', 't'] : handlesFor(from, to);
  const isSelected: boolean = context.selected.has(transition.id);
  const edge: TransitionFlowEdge = {
    id: transition.id,
    type: 'transition',
    ...ends(transition.from, transition.to, handles),
    markerEnd: arrow(isSelected),
    selected: isSelected,
    zIndex: EDGE_Z,
    data: transitionData(context, transition, from),
  };
  return [transition.label === '' ? edge : { ...edge, label: transition.label }];
}

const NOTE_LINK_CLASS: string =
  'pointer-events-none [&_path]:stroke-warning! [&_path]:[stroke-dasharray:4_4]';

/** The dashed line from a state to each of its notes. */
function noteLink(geometry: StateGeometry, note: StateNote): Edge[] {
  const target: Rect | undefined = boxOf(geometry, note.target);
  const box: Rect | undefined = boxOf(geometry, note.id);
  if (target === undefined || box === undefined) {
    return [];
  }
  const link: Edge = {
    id: `nl:${note.id}`,
    type: 'straight',
    ...ends(note.target, note.id, handlesFor(target, box)),
    selectable: false,
    focusable: false,
    deletable: false,
    zIndex: NOTE_LINK_Z,
    className: NOTE_LINK_CLASS,
  };
  return [link];
}

/** Transitions whose two ends are on the canvas, then the note links. */
export function stateEdges(
  model: StateModel,
  geometry: StateGeometry,
  selection: StateSelection,
): StateCanvasEdge[] {
  const context: EdgeContext = {
    geometry,
    pairs: parallels(model),
    selected: new Set<string>(selection.edges),
  };
  return [
    ...model.transitions.flatMap((transition: StateTransition) =>
      transitionEdge(context, transition),
    ),
    ...model.notes.flatMap((note: StateNote) => noteLink(geometry, note)),
  ];
}
