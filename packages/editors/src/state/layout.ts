// Canvas geometry for the state editor: leaf nodes, composite frames, a scope-by-scope dagre
// layout, and placing new items after an outside change.
import { findFreeSpot } from '@nautink/visual-core/geometry';

import { displayName, pseudoOf, regionOf, regionScopes, scopeChain, stateById } from './scopes.ts';
import { nodeSize } from './size.ts';
import { createLayoutGraph, runLayout, sizeLabel } from '../shared/dagre-graph.ts';
import { positionOf } from '../shared/positions.ts';

import type { LeafData } from './size.ts';
import type {
  NoteSide,
  Pseudo,
  StateModel,
  StateNode,
  StateNote,
  StateTransition,
} from './types.ts';
import type { LayoutGraph } from '../shared/dagre-graph.ts';
import type { Placement } from '../shared/positions.ts';
import type { GraphLabel, NodeLabel } from '@dagrejs/dagre';
import type { Point, Rect, Size } from '@nautink/visual-core/geometry';
import type { Position, PositionMap } from '@nautink/visual-core/positions';

const HALF: number = 0.5;
const PAD: number = 18;
const TITLE: number = 28;
const TITLE_INSET: number = 6;
const REGION_PAD: number = 10;
const REGION_GAP: number = 10;
const NOTE_GAP: number = 26;
const NOTE_STACK_GAP: number = 8;
const ORIGIN: number = 20;
const SPOT_GAP: number = 14;
const SPOT_STEP: number = 24;
const LINK_GAP: number = 60;
const SIBLING_GAP: number = 50;
const KNOWN_SHARE: number = 0.5;
const BOTH_SIDES: number = 2;
const MAX_DEPTH: number = 100;
type RankDirection = NonNullable<GraphLabel['rankdir']>;
const RANK_DIRECTIONS: readonly RankDirection[] = ['TB', 'BT', 'LR', 'RL'];

/** A node the canvas draws at its own position. `scope` is the frame it belongs to. */
export interface Leaf {
  id: string;
  scope: string | null;
  data: LeafData;
}

export interface Leaves {
  list: Leaf[];
  /** Is this a composite with something inside (drawn as a frame, not a leaf)? */
  isNonEmpty: (state: StateNode) => boolean;
}

/** fork/join bars lie flat in top-down layouts. */
export function isHorizontalBar(model: StateModel): boolean {
  return !model.direction || model.direction === 'TB' || model.direction === 'BT';
}

function pseudoIds(model: StateModel): string[] {
  const ids: string[] = model.transitions.flatMap((transition: StateTransition) => [
    transition.from,
    transition.to,
  ]);
  return [...new Set<string>([...ids.filter((id: string) => pseudoOf(id)), ...model.pseudo])];
}

// Scopes that hold something: every ancestor scope of a state or pseudo state.
function filledScopes(model: StateModel, pseudo: readonly string[]): Set<string> {
  const scopes: (string | null)[] = [
    ...model.states.map((state: StateNode) => state.parent),
    ...pseudo.map((id: string) => pseudoOf(id)?.scope ?? null),
  ];
  return new Set<string>(scopes.flatMap((scope: string | null) => scopeChain(model, scope)));
}

function stateData(model: StateModel, state: StateNode): LeafData {
  if (state.isComposite) {
    return { kind: 'emptyComposite', label: displayName(state) };
  }
  if (state.type === 'state') {
    return { kind: 'state', label: displayName(state), desc: state.desc };
  }
  return {
    kind: state.type,
    isHorizontal: isHorizontalBar(model),
    title: `${state.type} ${state.id}`,
  };
}

function stateLeaf(model: StateModel, state: StateNode): Leaf {
  return { id: state.id, scope: state.parent, data: stateData(model, state) };
}

function pseudoLeaf(model: StateModel, id: string, pseudo: Pseudo): Leaf {
  const title: string = pseudo.kind === 'start' ? 'Start [*]' : 'End [*]';
  return {
    id,
    scope: pseudo.scope,
    data: { kind: pseudo.kind, isLoose: model.pseudo.includes(id), title },
  };
}

function noteLeaf(model: StateModel, note: StateNote): Leaf {
  const scope: string | null = stateById(model, note.target)?.parent ?? null;
  return {
    id: note.id,
    scope,
    data: { kind: 'note', text: note.text, target: note.target, side: note.side },
  };
}

function pseudoLeaves(model: StateModel, pseudo: readonly string[]): Leaf[] {
  return pseudo.flatMap((id: string) => {
    const parsed: Pseudo | null = pseudoOf(id);
    return parsed ? [pseudoLeaf(model, id, parsed)] : [];
  });
}

/** Every leaf the canvas draws: plain states, pseudo states, empty composites and notes. */
export function leaves(model: StateModel): Leaves {
  const pseudo: string[] = pseudoIds(model);
  const filled: Set<string> = filledScopes(model, pseudo);
  // A region's scope chain runs through its composite, so filled regions mark it too.
  const hasChildren = (state: StateNode): boolean => filled.has(state.id);
  const list: Leaf[] = [
    ...model.states
      .filter((state: StateNode) => !state.isComposite || !hasChildren(state))
      .map((state: StateNode) => stateLeaf(model, state)),
    ...pseudoLeaves(model, pseudo),
    ...model.notes.map((note: StateNote) => noteLeaf(model, note)),
  ];
  return {
    list,
    isNonEmpty: (state: StateNode): boolean => state.isComposite && hasChildren(state),
  };
}

/** A composite with children, or one of its concurrent regions. */
export type Frame =
  | { id: string; kind: 'composite'; parent: string | null; depth: number; regions: number }
  | { id: string; kind: 'region'; parent: string; depth: number; owner: string; index: number };

/** Frames, deepest first. */
export function frames(model: StateModel, isNonEmpty: (state: StateNode) => boolean): Frame[] {
  const out: Frame[] = model.states.filter(isNonEmpty).flatMap((state: StateNode): Frame[] => {
    const depth: number = scopeChain(model, state.id).length;
    const regions: Frame[] = regionScopes(state.id, state.regions).map(
      (id: string, index: number): Frame => ({
        id,
        kind: 'region',
        parent: state.id,
        depth: depth + 1,
        owner: state.id,
        index,
      }),
    );
    return [
      { id: state.id, kind: 'composite', parent: state.parent, depth, regions: state.regions },
      ...regions,
    ];
  });
  return out.sort((a: Frame, b: Frame) => b.depth - a.depth);
}

function boundingBox(rects: readonly (Rect | undefined)[]): Rect | null {
  const present: Rect[] = rects.filter(
    (rect: Rect | undefined): rect is Rect => rect !== undefined,
  );
  if (present.length === 0) {
    return null;
  }
  const x1: number = Math.min(...present.map((rect: Rect) => rect.x));
  const y1: number = Math.min(...present.map((rect: Rect) => rect.y));
  const x2: number = Math.max(...present.map((rect: Rect) => rect.x + rect.w));
  const y2: number = Math.max(...present.map((rect: Rect) => rect.y + rect.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export interface BoxRequest {
  leaves: readonly Leaf[];
  frames: readonly Frame[];
  positions: PositionMap;
}

function grow(box: Rect | null, pad: { side: number; top: number; bottom: number }): Rect | null {
  return (
    box && {
      x: box.x - pad.side,
      y: box.y - pad.top,
      w: box.w + BOTH_SIDES * pad.side,
      h: box.h + pad.top + pad.bottom,
    }
  );
}

function regionsBox(
  frame: Frame,
  request: BoxRequest,
  boxes: Readonly<Record<string, Rect>>,
): Rect | null {
  const regions: (Rect | undefined)[] = request.frames
    .filter((other: Frame) => other.kind === 'region' && other.owner === frame.id)
    .map((other: Frame) => boxes[other.id]);
  return grow(boundingBox(regions), {
    side: TITLE_INSET,
    top: TITLE_INSET + TITLE,
    bottom: TITLE_INSET,
  });
}

function childBoxes(
  frame: Frame,
  request: BoxRequest,
  boxes: Readonly<Record<string, Rect>>,
): (Rect | undefined)[] {
  return [
    ...request.leaves
      .filter((leaf: Leaf) => leaf.scope === frame.id)
      .map((leaf: Leaf) => boxes[leaf.id]),
    ...request.frames
      .filter((other: Frame) => other.kind === 'composite' && other.parent === frame.id)
      .map((other: Frame) => boxes[other.id]),
  ];
}

function contentBox(
  frame: Frame,
  request: BoxRequest,
  boxes: Readonly<Record<string, Rect>>,
): Rect | null {
  const isRegion: boolean = frame.kind === 'region';
  const side: number = isRegion ? REGION_PAD : PAD;
  const top: number = isRegion ? REGION_PAD : PAD + TITLE - TITLE_INSET;
  return grow(boundingBox(childBoxes(frame, request, boxes)), { side, top, bottom: side });
}

function frameBox(
  frame: Frame,
  request: BoxRequest,
  boxes: Readonly<Record<string, Rect>>,
): Rect | null {
  const hasRegions: boolean = frame.kind === 'composite' && frame.regions > 0;
  return hasRegions ? regionsBox(frame, request, boxes) : contentBox(frame, request, boxes);
}

/** Boxes for every leaf (from positions) and every frame (from what it contains). */
export function computeBoxes(request: BoxRequest): Record<string, Rect> {
  const boxes: Record<string, Rect> = {};
  for (const leaf of request.leaves) {
    const position: Position | undefined = positionOf(request.positions, leaf.id);
    if (position) {
      const size: Size = nodeSize(leaf.data);
      boxes[leaf.id] = { x: position.x, y: position.y, w: size.width, h: size.height };
    }
  }
  for (const frame of request.frames) {
    const box: Rect | null = frameBox(frame, request, boxes);
    if (box) {
      boxes[frame.id] = box;
    }
  }
  return boxes;
}

// ---- full layout ----

/** A laid-out scope or composite: its size, and how to put its content at a top-left corner. */
interface Block {
  w: number;
  h: number;
  place: (x: number, y: number) => void;
}

interface Item {
  id: string;
  size: Size;
  place: (x: number, y: number) => void;
}

interface Extent {
  lw: number;
  w: number;
  h: number;
}

function stackHeight(sizes: readonly Size[]): number {
  return sizes.reduce(
    (total: number, size: Size) => total + size.height + NOTE_STACK_GAP,
    -NOTE_STACK_GAP,
  );
}

function sideWidth(sizes: readonly Size[]): number {
  return sizes.length ? Math.max(...sizes.map((size: Size) => size.width)) + NOTE_GAP : 0;
}

function rankdirOf(direction: string): GraphLabel {
  const rankdir: RankDirection | undefined = RANK_DIRECTIONS.find(
    (known: RankDirection) => known === direction,
  );
  return rankdir ? { rankdir } : {};
}

/** Lays a state model out scope by scope; composites become fixed-size blocks in their parent. */
class StateLayouter {
  readonly positions: PositionMap = {};
  readonly #model: StateModel;
  readonly #leaves: Leaves;
  readonly #scopeOf: Map<string, string | null>;

  constructor(model: StateModel) {
    this.#model = model;
    this.#leaves = leaves(model);
    this.#scopeOf = new Map<string, string | null>(
      this.#leaves.list.map((leaf: Leaf) => [leaf.id, leaf.scope]),
    );
  }

  scope(scope: string | null, direction: string): Block {
    const items: Item[] = this.#items(scope, direction);
    if (items.length === 0) {
      return { w: 0, h: 0, place: (): void => undefined };
    }
    const extents: Map<string, Extent> = new Map<string, Extent>(
      items.map((item: Item) => [item.id, this.#withNotes(item.id, item.size)]),
    );
    const layout: LayoutGraph = createLayoutGraph({
      graph: { ...rankdirOf(direction), nodesep: 40, ranksep: 54, marginx: 0, marginy: 0 },
    });
    for (const item of items) {
      const extent: Extent | undefined = extents.get(item.id);
      layout.setNode(item.id, sizeLabel({ width: extent?.w ?? 0, height: extent?.h ?? 0 }));
    }
    this.#addEdges(layout, scope);
    runLayout(layout);
    return placedBlock(items, layout, extents);
  }

  #items(scope: string | null, direction: string): Item[] {
    const leafItems: Item[] = this.#leaves.list
      .filter((leaf: Leaf) => leaf.data.kind !== 'note' && leaf.scope === scope)
      .map((leaf: Leaf) => ({
        id: leaf.id,
        size: nodeSize(leaf.data),
        place: (x: number, y: number): void => {
          this.#set(leaf.id, { x, y });
        },
      }));
    const compositeItems: Item[] = this.#model.states
      .filter((state: StateNode) => this.#leaves.isNonEmpty(state) && state.parent === scope)
      .map((state: StateNode) => {
        const block: Block = this.#composite(state, direction);
        return { id: state.id, size: { width: block.w, height: block.h }, place: block.place };
      });
    return [...leafItems, ...compositeItems];
  }

  #set(id: string, position: Position): void {
    this.positions[id] = position;
  }

  #parentOf(id: string): string | null {
    if (this.#scopeOf.has(id)) {
      return this.#scopeOf.get(id) ?? null;
    }
    return stateById(this.#model, id)?.parent ?? null;
  }

  // The item directly inside `scope` that contains node `id` (itself, or an enclosing composite).
  #ownerIn(id: string, scope: string | null): string | null {
    let current: string = id;
    let parent: string | null = this.#parentOf(id);
    for (let depth: number = 0; parent !== null && parent !== scope && depth < MAX_DEPTH; depth++) {
      current = regionOf(this.#model, parent)?.id ?? parent;
      parent = stateById(this.#model, current)?.parent ?? null;
    }
    return parent === scope ? current : null;
  }

  #addEdges(layout: LayoutGraph, scope: string | null): void {
    for (const transition of this.#model.transitions) {
      const from: string | null = this.#ownerIn(transition.from, scope);
      const to: string | null = this.#ownerIn(transition.to, scope);
      if (from !== null && to !== null && from !== to) {
        layout.setEdge(from, to);
      }
    }
  }

  // Notes on an item widen its slot so they get room beside it.
  #withNotes(id: string, size: Size): Extent {
    const notes: Leaf[] = this.#leaves.list.filter(
      (leaf: Leaf) => leaf.data.kind === 'note' && leaf.data.target === id,
    );
    const side = (wanted: NoteSide): Size[] =>
      notes
        .filter((leaf: Leaf) => leaf.data.kind === 'note' && leaf.data.side === wanted)
        .map((leaf: Leaf) => nodeSize(leaf.data));
    const left: Size[] = side('left');
    const right: Size[] = side('right');
    const lw: number = sideWidth(left);
    return {
      lw,
      w: size.width + lw + sideWidth(right),
      h: Math.max(size.height, stackHeight(left), stackHeight(right)),
    };
  }

  #composite(state: StateNode, parentDirection: string): Block {
    const direction: string = state.dir || parentDirection;
    if (state.regions > 0) {
      return this.#regions(state, direction);
    }
    const inner: Block = this.scope(state.id, direction);
    const top: number = PAD + TITLE - TITLE_INSET;
    return {
      w: inner.w + BOTH_SIDES * PAD,
      h: inner.h + top + PAD,
      place: (x: number, y: number): void => {
        inner.place(x + PAD, y + top);
      },
    };
  }

  #regions(state: StateNode, direction: string): Block {
    const isRow: boolean = direction === 'TB' || direction === 'BT';
    const regions: Block[] = regionScopes(state.id, state.regions)
      .map((scope: string) => this.scope(scope, direction))
      .filter((block: Block) => block.w || block.h)
      .map((block: Block) => ({
        ...block,
        w: block.w + BOTH_SIDES * REGION_PAD,
        h: block.h + BOTH_SIDES * REGION_PAD,
      }));
    const widths: number[] = regions.map((block: Block) => block.w);
    const heights: number[] = regions.map((block: Block) => block.h);
    return {
      w: (isRow ? alongside(widths) : Math.max(...widths)) + BOTH_SIDES * TITLE_INSET,
      h: (isRow ? Math.max(...heights) : alongside(heights)) + BOTH_SIDES * TITLE_INSET + TITLE,
      place: (x: number, y: number): void => {
        placeRegions(regions, { x: x + TITLE_INSET, y: y + TITLE_INSET + TITLE }, isRow);
      },
    };
  }
}

function alongside(sizes: readonly number[]): number {
  return sizes.reduce((total: number, size: number) => total + size + REGION_GAP, -REGION_GAP);
}

function placeRegions(regions: readonly Block[], start: Point, isRow: boolean): void {
  let corner: Point = start;
  for (const region of regions) {
    region.place(corner.x + REGION_PAD, corner.y + REGION_PAD);
    corner = isRow
      ? { ...corner, x: corner.x + region.w + REGION_GAP }
      : { ...corner, y: corner.y + region.h + REGION_GAP };
  }
}

interface LocalLayout {
  corners: Map<string, Point>;
  bounds: Rect[];
}

function itemLayout(
  item: Item,
  layout: LayoutGraph,
  extents: ReadonlyMap<string, Extent>,
): { corner: Point; bounds: Rect[] } {
  const node: NodeLabel = layout.node(item.id);
  const left: number = (node.x ?? 0) - node.width * HALF;
  const top: number = (node.y ?? 0) - node.height * HALF;
  const corner: Point = {
    x: left + (extents.get(item.id)?.lw ?? 0),
    y: (node.y ?? 0) - item.size.height * HALF,
  };
  return {
    corner,
    bounds: [
      { x: left, y: top, w: node.width, h: node.height },
      { x: left, y: corner.y, w: node.width, h: item.size.height },
    ],
  };
}

// Each item's corner in the scope's own coordinates, and the boxes the scope must cover.
function localLayout(
  items: readonly Item[],
  layout: LayoutGraph,
  extents: ReadonlyMap<string, Extent>,
): LocalLayout {
  const corners: Map<string, Point> = new Map<string, Point>();
  const bounds: Rect[] = [];
  for (const item of items) {
    const placed: { corner: Point; bounds: Rect[] } = itemLayout(item, layout, extents);
    corners.set(item.id, placed.corner);
    bounds.push(...placed.bounds);
  }
  return { corners, bounds };
}

function placedBlock(
  items: readonly Item[],
  layout: LayoutGraph,
  extents: ReadonlyMap<string, Extent>,
): Block {
  const { corners, bounds } = localLayout(items, layout, extents);
  const box: Rect = boundingBox(bounds) ?? { x: 0, y: 0, w: 0, h: 0 };
  return {
    w: box.w,
    h: box.h,
    place: (x: number, y: number): void => {
      for (const item of items) {
        const corner: Point = corners.get(item.id) ?? { x: 0, y: 0 };
        item.place(x + corner.x - box.x, y + corner.y - box.y);
      }
    },
  };
}

/** Full automatic layout: top-left positions keyed by leaf id. */
export function dagreLayout(model: StateModel): PositionMap {
  const layouter: StateLayouter = new StateLayouter(model);
  layouter.scope(null, model.direction || 'TB').place(ORIGIN, ORIGIN);
  return placeNotes(model, layouter.positions);
}

// ---- notes ----

function noteBoxes(
  model: StateModel,
  list: readonly Leaf[],
  positions: PositionMap,
): Record<string, Rect> {
  return computeBoxes({
    leaves: list.filter((leaf: Leaf) => leaf.data.kind !== 'note'),
    frames: frames(model, leaves(model).isNonEmpty),
    positions,
  });
}

/** Puts notes beside their target, stacked per side. With `onlyIds`, only those notes move. */
export function placeNotes(
  model: StateModel,
  positions: PositionMap,
  onlyIds?: ReadonlySet<string>,
): PositionMap {
  const { list } = leaves(model);
  const boxes: Record<string, Rect> = noteBoxes(model, list, positions);
  const placed: PositionMap = { ...positions };
  for (const { target, side, notes } of notesBySide(list)) {
    const box: Rect | undefined = boxes[target];
    const stacked: [string, Position][] = box ? stackNotes(notes, box, side === 'left') : [];
    for (const [id, position] of stacked.filter(
      ([id]: [string, Position]) => !onlyIds || onlyIds.has(id),
    )) {
      placed[id] = position;
    }
  }
  return placed;
}

interface NoteStack {
  target: string;
  side: NoteSide;
  notes: Leaf[];
}

function notesBySide(list: readonly Leaf[]): NoteStack[] {
  const stacks: Map<string, NoteStack> = new Map<string, NoteStack>();
  for (const leaf of list) {
    if (leaf.data.kind === 'note') {
      const key: string = `${leaf.data.target}|${leaf.data.side}`;
      const stack: NoteStack = stacks.get(key) ?? {
        target: leaf.data.target,
        side: leaf.data.side,
        notes: [],
      };
      stack.notes.push(leaf);
      stacks.set(key, stack);
    }
  }
  return [...stacks.values()];
}

function stackNotes(notes: readonly Leaf[], box: Rect, isLeft: boolean): [string, Position][] {
  const sizes: Size[] = notes.map((note: Leaf) => nodeSize(note.data));
  let y: number = box.y + box.h * HALF - stackHeight(sizes) * HALF;
  return notes.map((note: Leaf, index: number): [string, Position] => {
    const size: Size = sizes[index] ?? { width: 0, height: 0 };
    const x: number = isLeft ? box.x - NOTE_GAP - size.width : box.x + box.w + NOTE_GAP;
    const position: Position = { x, y };
    y += size.height + NOTE_STACK_GAP;
    return [note.id, position];
  });
}

/** Places one note beside its target. */
export function placeNote(model: StateModel, positions: PositionMap, noteId: string): PositionMap {
  return placeNotes(model, positions, new Set<string>([noteId]));
}

// ---- incremental placement ----

function labelKey(leaf: Leaf): string {
  if (leaf.data.kind === 'note') {
    return `note:${leaf.data.target}`;
  }
  return leaf.data.kind === 'state' || leaf.data.kind === 'emptyComposite'
    ? leaf.data.label
    : leaf.data.kind;
}

/**
 * Remembers each leaf's label next to its position, so a reused id with a new meaning (a fresh
 * diagram from Claude) is not pinned to an old spot.
 */
export function tagLabels(model: StateModel, positions: PositionMap): PositionMap {
  const tagged: PositionMap = { ...positions };
  for (const leaf of leaves(model).list) {
    const position: Position | undefined = positionOf(tagged, leaf.id);
    if (position) {
      tagged[leaf.id] = { ...position, l: labelKey(leaf) };
    }
  }
  return tagged;
}

export interface FreeSpotRequest {
  model: StateModel;
  positions: PositionMap;
  size: Size;
  start: Point;
  ignore?: readonly string[];
  extra?: readonly Rect[];
}

/** The nearest free spot to `start` (top-left), searching outward in rings. */
export function freeSpot({
  model,
  positions,
  size,
  start,
  ignore = [],
  extra = [],
}: FreeSpotRequest): Point {
  const rects: Rect[] = leaves(model).list.flatMap((leaf: Leaf) => {
    const position: Position | undefined = positionOf(positions, leaf.id);
    const leafSize: Size = nodeSize(leaf.data);
    return position && !ignore.includes(leaf.id)
      ? [{ x: position.x, y: position.y, w: leafSize.width, h: leafSize.height }]
      : [];
  });
  return findFreeSpot({ rects: [...rects, ...extra], size, start, gap: SPOT_GAP, step: SPOT_STEP });
}

function isKnownLeaf(positions: PositionMap, leaf: Leaf): boolean {
  const position: Position | undefined = positionOf(positions, leaf.id);
  return position !== undefined && (position.l === undefined || position.l === labelKey(leaf));
}

interface LinkStart {
  anchor: Position;
  anchorSize: Size;
  size: Size;
  isBefore: boolean;
}

function linkedStart(direction: string, { anchor, anchorSize, size, isBefore }: LinkStart): Point {
  const centerX: number = anchor.x + anchorSize.width * HALF - size.width * HALF;
  const centerY: number = anchor.y + anchorSize.height * HALF - size.height * HALF;
  const above: number = anchor.y - LINK_GAP - size.height;
  const below: number = anchor.y + anchorSize.height + LINK_GAP;
  const leftOf: number = anchor.x - LINK_GAP - size.width;
  const rightOf: number = anchor.x + anchorSize.width + LINK_GAP;
  const spots: Readonly<Record<string, Point>> = {
    BT: { x: centerX, y: isBefore ? below : above },
    LR: { x: isBefore ? leftOf : rightOf, y: centerY },
    RL: { x: isBefore ? rightOf : leftOf, y: centerY },
  };
  return spots[direction] ?? { x: centerX, y: isBefore ? above : below };
}

interface PlaceContext {
  model: StateModel;
  list: readonly Leaf[];
  nodes: readonly Leaf[];
}

function linkOf(
  model: StateModel,
  positions: PositionMap,
  id: string,
): StateTransition | undefined {
  return (
    model.transitions.find(
      (transition: StateTransition) =>
        transition.to === id && positionOf(positions, transition.from),
    ) ??
    model.transitions.find(
      (transition: StateTransition) =>
        transition.from === id && positionOf(positions, transition.to),
    )
  );
}

function linkStart(context: PlaceContext, positions: PositionMap, leaf: Leaf): Point | null {
  const link: StateTransition | undefined = linkOf(context.model, positions, leaf.id);
  const anchorId: string = link?.to === leaf.id ? link.from : (link?.to ?? '');
  const anchor: Position | undefined = positionOf(positions, anchorId);
  const anchorLeaf: Leaf | undefined = context.list.find(
    (candidate: Leaf) => candidate.id === anchorId,
  );
  if (!link || !anchor || !anchorLeaf) {
    return null;
  }
  return linkedStart(context.model.direction || 'TB', {
    anchor,
    anchorSize: nodeSize(anchorLeaf.data),
    size: nodeSize(leaf.data),
    isBefore: link.from === leaf.id,
  });
}

function siblingStart(context: PlaceContext, positions: PositionMap, leaf: Leaf): Point {
  const placed: Leaf[] = context.nodes.filter((node: Leaf) => positionOf(positions, node.id));
  const siblings: Leaf[] = placed.filter((node: Leaf) => node.scope === leaf.scope);
  // Only called once some leaves are known, so the pool is never empty.
  const pool: Leaf[] = siblings.length ? siblings : placed;
  const rights: number[] = pool.map(
    (node: Leaf) => (positionOf(positions, node.id)?.x ?? 0) + nodeSize(node.data).width,
  );
  const tops: number[] = pool.map((node: Leaf) => positionOf(positions, node.id)?.y ?? 0);
  return { x: Math.max(...rights) + SIBLING_GAP, y: Math.min(...tops) };
}

function placeUnknown(
  context: PlaceContext,
  positions: PositionMap,
  unknown: readonly Leaf[],
): PositionMap {
  const placed: PositionMap = { ...positions };
  for (const leaf of unknown) {
    const start: Point = linkStart(context, placed, leaf) ?? siblingStart(context, placed, leaf);
    placed[leaf.id] = freeSpot({
      model: context.model,
      positions: placed,
      size: nodeSize(leaf.data),
      start,
    });
  }
  return placed;
}

function keptPositions(positions: PositionMap, kept: readonly Leaf[]): PositionMap {
  return Object.fromEntries(
    kept.flatMap((leaf: Leaf): [string, Position][] => {
      const position: Position | undefined = positionOf(positions, leaf.id);
      return position ? [[leaf.id, position]] : [];
    }),
  );
}

/**
 * Positions after the model changed from outside (code edit, Claude): known leaves keep their
 * spot, new ones go next to a linked neighbour or their siblings, new notes beside their target.
 * Lays everything out again when most leaves are unknown.
 */
export function placeNodes(model: StateModel, positions: PositionMap): Placement {
  const { list } = leaves(model);
  const nodes: Leaf[] = list.filter((leaf: Leaf) => leaf.data.kind !== 'note');
  const known: Leaf[] = nodes.filter((leaf: Leaf) => isKnownLeaf(positions, leaf));
  if (nodes.length > 0 && known.length < nodes.length * KNOWN_SHARE) {
    return { positions: tagLabels(model, dagreLayout(model)), isFullLayout: true };
  }
  const notes: Leaf[] = list.filter((leaf: Leaf) => leaf.data.kind === 'note');
  const knownNotes: Leaf[] = notes.filter(
    (leaf: Leaf) => positionOf(positions, leaf.id)?.l === labelKey(leaf),
  );
  const kept: PositionMap = keptPositions(positions, [...known, ...knownNotes]);
  const unknown: Leaf[] = nodes.filter((leaf: Leaf) => !known.includes(leaf));
  const placed: PositionMap = placeUnknown({ model, list, nodes }, kept, unknown);
  const newNotes: Set<string> = new Set<string>(
    notes.filter((leaf: Leaf) => !knownNotes.includes(leaf)).map((leaf: Leaf) => leaf.id),
  );
  const withNotes: PositionMap = newNotes.size ? placeNotes(model, placed, newNotes) : placed;
  return { positions: tagLabels(model, withNotes), isFullLayout: false };
}
