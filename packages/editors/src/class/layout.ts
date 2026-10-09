// Canvas placement for the class editor: classes, notes and lollipop interfaces as items, a full
// dagre layout, and placing new items next to a neighbour after an outside change.
import { findFreeSpot, overlaps } from '@nautink/visual-core/geometry';

import { classSize, LOLLI_SIZE, noteSize } from './measure.ts';
import { nsParent } from './text.ts';
import { createLayoutGraph, runLayout, sizeLabel, topLeftOf } from '../shared/dagre-graph.ts';
import { positionOf, rectAt } from '../shared/positions.ts';

import type { ClassItem, ClassModel, ClassNote, ClassRelation } from './types.ts';
import type { LayoutGraph } from '../shared/dagre-graph.ts';
import type { Placement } from '../shared/positions.ts';
import type { Point, Rect, Size } from '@nautink/visual-core/geometry';
import type { Position, PositionMap } from '@nautink/visual-core/positions';
import type { TextMeasurer } from '@nautink/visual-core/text-measure';

const HALF: number = 0.5;
const GAP: number = 20;
const SPOT_GAP: number = 48;
const SPOT_STEP: number = 30;
const RANK_GAP: number = 80;
const CROSS_GAP: number = 100;
const NEXT_TO_ALL: number = 80;
const NUDGE: number = 40;
const MAX_NUDGES: number = 40;
const KNOWN_SHARE: number = 0.5;

/** A positioned canvas item. `ns` is the namespace frame it sits in. */
export type CanvasItem =
  | { id: string; kind: 'class'; size: Size; ns: string; item: ClassItem }
  | { id: string; kind: 'note'; size: Size; ns: string; item: ClassNote }
  | { id: string; kind: 'lolli'; size: Size; ns: string; item: ClassRelation };

/** Canvas id of a relation's lollipop circle. */
export function lolliId(relation: ClassRelation): string {
  return `lolli:${relation.id}`;
}

function isLollipop(relation: ClassRelation): boolean {
  return relation.t1 === 'lolli' || relation.t2 === 'lolli';
}

function classItem(item: ClassItem, measure: TextMeasurer): CanvasItem {
  return { id: item.id, kind: 'class', size: classSize(item, measure), ns: item.ns, item };
}

function noteItem(note: ClassNote, measure: TextMeasurer): CanvasItem {
  return { id: note.id, kind: 'note', size: noteSize(note, measure), ns: note.ns, item: note };
}

function lolliItem(relation: ClassRelation): CanvasItem {
  return { id: lolliId(relation), kind: 'lolli', size: LOLLI_SIZE, ns: '', item: relation };
}

/** Every positioned canvas item: classes, notes, then lollipop circles. */
export function canvasItems(model: ClassModel, measure: TextMeasurer): CanvasItem[] {
  return [
    ...model.classes.map((item: ClassItem) => classItem(item, measure)),
    ...model.notes.map((note: ClassNote) => noteItem(note, measure)),
    ...model.relations.filter(isLollipop).map(lolliItem),
  ];
}

/** The two ends of a relation as canvas item ids. */
export function relationEnds(relation: ClassRelation): [string, string] {
  return [
    relation.t1 === 'lolli' ? lolliId(relation) : relation.from,
    relation.t2 === 'lolli' ? lolliId(relation) : relation.to,
  ];
}

/** All namespace ids, implicit parents included. */
export function allNamespaces(model: ClassModel): string[] {
  const ids: Set<string> = new Set<string>([
    ...model.namespaces.map((namespace: { id: string }) => namespace.id),
    ...model.classes.map((item: ClassItem) => item.ns).filter(Boolean),
    ...model.notes.map((note: ClassNote) => note.ns).filter(Boolean),
  ]);
  for (const id of [...ids]) {
    for (let parent: string = nsParent(id); parent; parent = nsParent(parent)) {
      ids.add(parent);
    }
  }
  return [...ids];
}

// UML habit: the general / whole end sits above the specific / part end.
function rankedEnds(relation: ClassRelation): [string, string] {
  const [from, to] = relationEnds(relation);
  const hasTargetMarker: boolean =
    relation.t2 !== 'none' && relation.t2 !== 'dep' && relation.t2 !== 'lolli';
  const isPlainSource: boolean = relation.t1 === 'none' || relation.t1 === 'dep';
  return hasTargetMarker && isPlainSource ? [to, from] : [from, to];
}

function addNamespaces(layout: LayoutGraph, model: ClassModel, items: readonly CanvasItem[]): void {
  const namespaces: string[] = allNamespaces(model);
  for (const id of namespaces) {
    layout.setNode(`ns:${id}`, { width: 0, height: 0, paddingTop: 34 });
  }
  for (const id of namespaces.filter((ns: string) => nsParent(ns))) {
    layout.setParent(`ns:${id}`, `ns:${nsParent(id)}`);
  }
  for (const item of items.filter((canvasItem: CanvasItem) => canvasItem.ns)) {
    if (layout.hasNode(`ns:${item.ns}`)) {
      layout.setParent(item.id, `ns:${item.ns}`);
    }
  }
}

function addLinks(layout: LayoutGraph, model: ClassModel): void {
  for (const relation of model.relations) {
    const [from, to] = rankedEnds(relation);
    if (from !== to && layout.hasNode(from) && layout.hasNode(to)) {
      layout.setEdge(from, to, { minlen: 1 }, relation.id);
    }
  }
  for (const note of model.notes) {
    if (note.for && layout.hasNode(note.for)) {
      layout.setEdge(note.id, note.for, { minlen: 1 }, note.id);
    }
  }
}

/** Full automatic layout: top-left positions keyed by item id. */
export function dagreLayout(model: ClassModel, measure: TextMeasurer): PositionMap {
  const layout: LayoutGraph = createLayoutGraph({
    graph: { rankdir: model.direction, nodesep: 50, ranksep: 80, marginx: 20, marginy: 20 },
    isCompound: true,
    isMultigraph: true,
  });
  const items: CanvasItem[] = canvasItems(model, measure);
  for (const item of items) {
    layout.setNode(item.id, sizeLabel(item.size));
  }
  addNamespaces(layout, model, items);
  addLinks(layout, model);
  runLayout(layout);
  return Object.fromEntries(
    items.map((item: CanvasItem) => {
      const corner: Point = topLeftOf(layout, item.id);
      return [item.id, { x: Math.round(corner.x), y: Math.round(corner.y) }];
    }),
  );
}

function itemRects(
  items: readonly CanvasItem[],
  positions: PositionMap,
  skipId: string = '',
): Rect[] {
  return items.flatMap((item: CanvasItem) => {
    const position: Position | undefined = positionOf(positions, item.id);
    return position && item.id !== skipId ? [rectAt(position, item.size)] : [];
  });
}

function nextTo(direction: string, anchor: Rect, size: Size): Point {
  const centerX: number = anchor.x + anchor.w * HALF - size.width * HALF;
  const centerY: number = anchor.y + anchor.h * HALF - size.height * HALF;
  const spots: Readonly<Record<string, Point>> = {
    BT: { x: centerX, y: anchor.y - size.height - RANK_GAP },
    LR: { x: anchor.x + anchor.w + CROSS_GAP, y: centerY },
    RL: { x: anchor.x - size.width - CROSS_GAP, y: centerY },
  };
  return spots[direction] ?? { x: centerX, y: anchor.y + anchor.h + RANK_GAP };
}

export interface PlaceNearRequest {
  model: ClassModel;
  positions: PositionMap;
  item: CanvasItem;
  anchorId: string | null;
  measure: TextMeasurer;
}

function anchorRect(request: PlaceNearRequest, items: readonly CanvasItem[]): Rect | undefined {
  const { anchorId, positions } = request;
  const position: Position | undefined = anchorId ? positionOf(positions, anchorId) : undefined;
  const anchor: CanvasItem | undefined = items.find((item: CanvasItem) => item.id === anchorId);
  return position && anchor ? rectAt(position, anchor.size) : undefined;
}

function startSpot(
  request: PlaceNearRequest,
  items: readonly CanvasItem[],
  others: readonly Rect[],
): Point {
  const anchor: Rect | undefined = anchorRect(request, items);
  if (anchor) {
    return nextTo(request.model.direction, anchor, request.item.size);
  }
  if (others.length === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.max(...others.map((rect: Rect) => rect.x + rect.w)) + NEXT_TO_ALL,
    y: Math.min(...others.map((rect: Rect) => rect.y)),
  };
}

/** A spot for `item` next to its anchor in the flow direction, nudged until it overlaps nothing. */
export function placeNear(request: PlaceNearRequest): Point {
  const items: CanvasItem[] = canvasItems(request.model, request.measure);
  const others: Rect[] = itemRects(items, request.positions, request.item.id);
  const isHorizontal: boolean =
    request.model.direction === 'LR' || request.model.direction === 'RL';
  let spot: Point = startSpot(request, items, others);
  for (let step: number = 0; step < MAX_NUDGES; step++) {
    if (!others.some((other: Rect) => overlaps(rectAt(spot, request.item.size), other, GAP))) {
      break;
    }
    spot = isHorizontal ? { ...spot, y: spot.y + NUDGE } : { ...spot, x: spot.x + NUDGE };
  }
  return { x: Math.round(spot.x), y: Math.round(spot.y) };
}

export interface FreeSpotRequest {
  model: ClassModel;
  positions: PositionMap;
  size: Size;
  start: Point;
  measure: TextMeasurer;
}

/** The nearest free spot to `start` (top-left), searching outward in rings. */
export function freeSpot({ model, positions, size, start, measure }: FreeSpotRequest): Point {
  const rects: Rect[] = itemRects(canvasItems(model, measure), positions);
  return findFreeSpot({ rects, size, start, gap: SPOT_GAP, step: SPOT_STEP });
}

/**
 * Notes are keyed by their place in the source, so their text is remembered next to the
 * position: a key reused for a different note gets placed again instead of inheriting the spot.
 */
export function tagItems(model: ClassModel, positions: PositionMap): PositionMap {
  const tagged: PositionMap = { ...positions };
  for (const note of model.notes) {
    const position: Position | undefined = positionOf(tagged, note.id);
    if (position) {
      tagged[note.id] = { ...position, l: note.text };
    }
  }
  return tagged;
}

function isKnown(positions: PositionMap, item: CanvasItem): boolean {
  const position: Position | undefined = positionOf(positions, item.id);
  if (position === undefined) {
    return false;
  }
  return item.kind !== 'note' || position.l === undefined || position.l === item.item.text;
}

function linkedAnchor(model: ClassModel, positions: PositionMap, id: string): string | null {
  for (const relation of model.relations) {
    const [from, to] = relationEnds(relation);
    if (from === id && positionOf(positions, to)) {
      return to;
    }
    if (to === id && positionOf(positions, from)) {
      return from;
    }
  }
  return null;
}

function anchorOf(model: ClassModel, positions: PositionMap, item: CanvasItem): string | null {
  if (item.kind === 'note') {
    return item.item.for || null;
  }
  if (item.kind === 'lolli') {
    return item.item.t1 === 'lolli' ? item.item.to : item.item.from;
  }
  return linkedAnchor(model, positions, item.id);
}

interface PlaceContext {
  model: ClassModel;
  measure: TextMeasurer;
}

function placeUnknown(
  context: PlaceContext,
  known: PositionMap,
  unknown: readonly CanvasItem[],
): PositionMap {
  const placed: PositionMap = { ...known };
  for (const item of unknown) {
    const anchorId: string | null = anchorOf(context.model, placed, item);
    placed[item.id] = placeNear({ ...context, positions: placed, item, anchorId });
  }
  return placed;
}

function knownPositions(positions: PositionMap, known: readonly CanvasItem[]): PositionMap {
  return Object.fromEntries(
    known.flatMap((item: CanvasItem): [string, Position][] => {
      const position: Position | undefined = positionOf(positions, item.id);
      return position ? [[item.id, position]] : [];
    }),
  );
}

/**
 * Positions after the model changed from outside (code edit, Claude): known items keep their
 * spot, new ones go next to a neighbour. Lays everything out again when most items are unknown.
 */
export function placeItems(
  model: ClassModel,
  positions: PositionMap,
  measure: TextMeasurer,
): Placement {
  const items: CanvasItem[] = canvasItems(model, measure);
  const known: CanvasItem[] = items.filter((item: CanvasItem) => isKnown(positions, item));
  if (items.length > 0 && known.length < items.length * KNOWN_SHARE) {
    return { positions: tagItems(model, dagreLayout(model, measure)), isFullLayout: true };
  }
  const unknown: CanvasItem[] = items.filter((item: CanvasItem) => !known.includes(item));
  const placed: PositionMap = placeUnknown(
    { model, measure },
    knownPositions(positions, known),
    unknown,
  );
  return { positions: tagItems(model, placed), isFullLayout: false };
}
