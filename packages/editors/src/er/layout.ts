// Canvas placement for the ER editor: full dagre layout (with fallbacks, since dagre can throw on
// some compound graphs), and placing new entities next to a neighbour after an outside change.
import { findFreeSpot, overlaps } from '@nautink/visual-core/geometry';

import { entityLayout } from './size.ts';
import {
  createLayoutGraph,
  runLayout,
  setParents,
  sizeLabel,
  topLeftOf,
} from '../shared/dagre-graph.ts';
import { positionOf, rectAt } from '../shared/positions.ts';
import { parentMap } from '../shared/subgraphs.ts';

import type { ErEntity, ErModel, ErRelationship, ErSubgraph } from './model.ts';
import type { LayoutGraph } from '../shared/dagre-graph.ts';
import type { Placement } from '../shared/positions.ts';
import type { GraphLabel } from '@dagrejs/dagre';
import type { Point, Rect, Size } from '@nautink/visual-core/geometry';
import type { Position, PositionMap } from '@nautink/visual-core/positions';
import type { TextMeasurer } from '@nautink/visual-core/text-measure';

const HALF: number = 0.5;
const GAP: number = 24;
const SPOT_STEP: number = 30;
const RANK_GAP: number = 90;
const CROSS_GAP: number = 130;
const NEXT_TO_ALL: number = 90;
const NUDGE: number = 30;
const MAX_NUDGES: number = 40;
const KNOWN_SHARE: number = 0.5;
const GRID_COLUMNS: number = 4;
const GRID_X: number = 320;
const GRID_Y: number = 260;
const LABEL_PAD: number = 16;
const LABEL_ROW: number = 22;
const LABEL_FONT: string = '11px sans-serif';
const PAIR_SEPARATOR: string = '\u0000';

/** How much of the diagram dagre is asked to handle: subgraphs, and room for link labels. */
interface LayoutAttempt {
  hasGroups: boolean;
  hasLabels: boolean;
}

const ATTEMPTS: readonly LayoutAttempt[] = [
  { hasGroups: true, hasLabels: true },
  { hasGroups: false, hasLabels: true },
  { hasGroups: false, hasLabels: false },
];

function sizeOf(entity: ErEntity, measure: TextMeasurer): Size {
  const { width, height } = entityLayout(entity, measure);
  return { width, height };
}

function isHorizontal(model: ErModel): boolean {
  return model.direction === 'LR' || model.direction === 'RL';
}

function addGroups(layout: LayoutGraph, model: ErModel): void {
  for (const subgraph of model.subgraphs) {
    layout.setNode(subgraph.id, { width: 0, height: 0, paddingTop: 30 });
  }
  setParents(layout, parentMap(model.subgraphs));
}

function isLayoutLink(
  layout: LayoutGraph,
  groupIds: ReadonlySet<string>,
  link: ErRelationship,
): boolean {
  const isTouchingGroup: boolean = groupIds.has(link.from) || groupIds.has(link.to);
  return (
    !isTouchingGroup &&
    link.from !== link.to &&
    layout.hasNode(link.from) &&
    layout.hasNode(link.to)
  );
}

// One dagre edge per entity pair (parallel edges break dagre's compound layout); its label box is
// tall enough for every label between the pair.
function labelBoxes(layout: LayoutGraph, model: ErModel, measure: TextMeasurer): Map<string, Size> {
  const groupIds: Set<string> = new Set<string>(
    model.subgraphs.map((subgraph: ErSubgraph) => subgraph.id),
  );
  const pairs: Map<string, Size> = new Map<string, Size>();
  for (const link of model.rels.filter((rel: ErRelationship) =>
    isLayoutLink(layout, groupIds, rel),
  )) {
    const back: string = `${link.to}${PAIR_SEPARATOR}${link.from}`;
    const key: string = pairs.has(back) ? back : `${link.from}${PAIR_SEPARATOR}${link.to}`;
    const box: Size = pairs.get(key) ?? { width: 0, height: 0 };
    pairs.set(key, {
      width: Math.max(box.width, measure(link.label || ' ', LABEL_FONT) + LABEL_PAD),
      height: box.height + LABEL_ROW,
    });
  }
  return pairs;
}

function addLinks(layout: LayoutGraph, model: ErModel, context: AttemptContext): void {
  for (const [key, box] of labelBoxes(layout, model, context.measure)) {
    const [from = '', to = ''] = key.split(PAIR_SEPARATOR);
    layout.setEdge(from, to, context.attempt.hasLabels ? { ...box, labelpos: 'c' } : {});
  }
}

interface AttemptContext {
  attempt: LayoutAttempt;
  measure: TextMeasurer;
}

const SPACING: Readonly<Record<'horizontal' | 'vertical', GraphLabel>> = {
  horizontal: { nodesep: 50, ranksep: 130 },
  vertical: { nodesep: 70, ranksep: 100 },
};

function graphLabel(model: ErModel): GraphLabel {
  const spacing: GraphLabel = isHorizontal(model) ? SPACING.horizontal : SPACING.vertical;
  return { rankdir: model.direction, ...spacing, edgesep: 30, marginx: 20, marginy: 20 };
}

function runDagre(model: ErModel, context: AttemptContext): PositionMap {
  const layout: LayoutGraph = createLayoutGraph({ graph: graphLabel(model), isCompound: true });
  for (const entity of model.entities) {
    layout.setNode(entity.name, sizeLabel(sizeOf(entity, context.measure)));
  }
  if (context.attempt.hasGroups) {
    addGroups(layout, model);
  }
  addLinks(layout, model, context);
  runLayout(layout);
  return Object.fromEntries(
    model.entities.map((entity: ErEntity) => [entity.name, roundedCorner(layout, entity.name)]),
  );
}

function roundedCorner(layout: LayoutGraph, id: string): Point {
  const corner: Point = topLeftOf(layout, id);
  return { x: Math.round(corner.x), y: Math.round(corner.y) };
}

/** The last resort when dagre fails: a grid of four columns. */
export function gridLayout(model: ErModel): PositionMap {
  return Object.fromEntries(
    model.entities.map((entity: ErEntity, index: number) => [
      entity.name,
      { x: (index % GRID_COLUMNS) * GRID_X, y: Math.floor(index / GRID_COLUMNS) * GRID_Y },
    ]),
  );
}

/** Runs each layout until one does not throw; falls back to the grid. */
export function firstLayout(
  model: ErModel,
  layouts: readonly ((model: ErModel) => PositionMap)[],
): PositionMap {
  for (const layout of layouts) {
    try {
      return layout(model);
    } catch {
      // Dagre threw on this setup; try the next, simpler one.
    }
  }
  return gridLayout(model);
}

/** Full automatic layout: top-left positions keyed by entity name. */
export function dagreLayout(model: ErModel, measure: TextMeasurer): PositionMap {
  return firstLayout(
    model,
    ATTEMPTS.map(
      (attempt: LayoutAttempt) => (target: ErModel) => runDagre(target, { attempt, measure }),
    ),
  );
}

interface PlaceContext {
  model: ErModel;
  measure: TextMeasurer;
}

function entityRects(context: PlaceContext, positions: PositionMap, skipName: string = ''): Rect[] {
  return context.model.entities.flatMap((entity: ErEntity) => {
    const position: Position | undefined = positionOf(positions, entity.name);
    return position && entity.name !== skipName
      ? [rectAt(position, sizeOf(entity, context.measure))]
      : [];
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

export interface PlaceNearRequest extends PlaceContext {
  positions: PositionMap;
  entity: ErEntity;
  anchorName: string | null;
}

function anchorRect(request: PlaceNearRequest): Rect | undefined {
  const { anchorName, positions, model, measure } = request;
  const position: Position | undefined = anchorName ? positionOf(positions, anchorName) : undefined;
  const anchor: ErEntity | undefined = model.entities.find(
    (entity: ErEntity) => entity.name === anchorName,
  );
  return position && anchor ? rectAt(position, sizeOf(anchor, measure)) : undefined;
}

function startSpot(request: PlaceNearRequest, others: readonly Rect[], size: Size): Point {
  const anchor: Rect | undefined = anchorRect(request);
  if (anchor) {
    return nextTo(request.model.direction, anchor, size);
  }
  if (others.length === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.max(...others.map((rect: Rect) => rect.x + rect.w)) + NEXT_TO_ALL,
    y: Math.min(...others.map((rect: Rect) => rect.y)),
  };
}

/** A spot for `entity` next to its anchor in the flow direction, nudged until it overlaps nothing. */
export function placeNear(request: PlaceNearRequest): Point {
  const others: Rect[] = entityRects(request, request.positions, request.entity.name);
  const size: Size = sizeOf(request.entity, request.measure);
  let spot: Point = startSpot(request, others, size);
  for (let step: number = 0; step < MAX_NUDGES; step++) {
    if (!others.some((other: Rect) => overlaps(rectAt(spot, size), other, GAP))) {
      break;
    }
    spot = isHorizontal(request.model)
      ? { ...spot, y: spot.y + size.height + NUDGE }
      : { ...spot, x: spot.x + size.width + NUDGE };
  }
  return { x: Math.round(spot.x), y: Math.round(spot.y) };
}

export interface FreeSpotRequest extends PlaceContext {
  positions: PositionMap;
  size: Size;
  start: Point;
}

/** The nearest free spot to `start` (top-left), searching outward in rings. */
export function freeSpot(request: FreeSpotRequest): Point {
  const rects: Rect[] = entityRects(request, request.positions);
  return findFreeSpot({
    rects,
    size: request.size,
    start: request.start,
    gap: GAP,
    step: SPOT_STEP,
  });
}

function anchorOf(model: ErModel, positions: PositionMap, name: string): string | null {
  const incoming: ErRelationship | undefined = model.rels.find(
    (link: ErRelationship) =>
      link.to === name && link.from !== name && positionOf(positions, link.from),
  );
  if (incoming) {
    return incoming.from;
  }
  const outgoing: ErRelationship | undefined = model.rels.find(
    (link: ErRelationship) =>
      link.from === name && link.to !== name && positionOf(positions, link.to),
  );
  return outgoing ? outgoing.to : null;
}

function placeUnknown(context: PlaceContext, positions: PositionMap): PositionMap {
  const placed: PositionMap = Object.fromEntries(
    context.model.entities.flatMap((entity: ErEntity): [string, Position][] => {
      const position: Position | undefined = positionOf(positions, entity.name);
      return position ? [[entity.name, position]] : [];
    }),
  );
  for (const entity of context.model.entities.filter(
    (candidate: ErEntity) => !positionOf(placed, candidate.name),
  )) {
    const anchorName: string | null = anchorOf(context.model, placed, entity.name);
    placed[entity.name] = placeNear({ ...context, positions: placed, entity, anchorName });
  }
  return placed;
}

/**
 * Positions after the model changed from outside (code edit, Claude). Entity names are meaningful
 * ids, so a known name keeps its spot. Lays everything out again when most entities are unknown.
 */
export function placeEntities(
  model: ErModel,
  positions: PositionMap,
  measure: TextMeasurer,
): Placement {
  const known: number = model.entities.filter((entity: ErEntity) =>
    positionOf(positions, entity.name),
  ).length;
  if (model.entities.length > 0 && known < model.entities.length * KNOWN_SHARE) {
    return { positions: dagreLayout(model, measure), isFullLayout: true };
  }
  return { positions: placeUnknown({ model, measure }, positions), isFullLayout: false };
}
