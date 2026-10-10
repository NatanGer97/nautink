// Moving things on the state canvas: a state moved to another composite (v1's `actions.setParent`),
// and drags or nudges that carry a composite's content and a state's notes along.
import { freeSpot } from '@nautink/editors/state/layout';
import * as ops from '@nautink/editors/state/ops';
import { regionOf } from '@nautink/editors/state/scopes';

import { run } from './state-actions.ts';
import { boxOf, carriedBy, stateGeometry } from './state-geometry.ts';
import { stateName } from './state-names.ts';

import type { StateActionContext } from './state-actions.ts';
import type { StateGeometry } from './state-geometry.ts';
import type { StateModel } from '@nautink/editors/state/types';
import type { Point, Rect, Size } from '@nautink/visual-core/geometry';
import type { Position, PositionMap } from '@nautink/visual-core/positions';

const HALF: number = 0.5;
/** A moved state lands this far inside its new composite's bottom-right corner. */
const CORNER_INSET: number = 30;
const TOP_LEVEL_GAP: number = 60;

function centerOf(box: Rect): Point {
  return { x: box.x + box.w * HALF, y: box.y + box.h * HALF };
}

/** Where a state moving to `scope` should be centred: in the new frame's corner, or right of all. */
function arrival(
  model: StateModel,
  geometry: StateGeometry,
  request: { own: Rect; scope: string | null },
): Point {
  const { own, scope } = request;
  const target: Rect | undefined =
    scope === null
      ? undefined
      : (boxOf(geometry, scope) ?? boxOf(geometry, regionOf(model, scope)?.id ?? ''));
  if (target !== undefined) {
    return { x: target.x + target.w - CORNER_INSET, y: target.y + target.h - CORNER_INSET };
  }
  const right: number = Math.max(
    ...Object.values(geometry.boxes).map((box: Rect) => box.x + box.w),
  );
  return { x: right + TOP_LEVEL_GAP + own.w * HALF, y: centerOf(own).y };
}

/** The shift that puts a state (with what it carries) into free space at its new home. */
function moveDelta(
  context: StateActionContext,
  model: StateModel,
  request: { id: string; scope: string | null; ids: string[] },
): Point | null {
  const geometry: StateGeometry = stateGeometry(model, context.positions.get());
  const own: Rect | undefined = boxOf(geometry, request.id);
  if (own === undefined) {
    return null;
  }
  const at: Point = arrival(model, geometry, { own, scope: request.scope });
  const center: Point = centerOf(own);
  const start: Point = { x: own.x + at.x - center.x, y: own.y + at.y - center.y };
  const positions: PositionMap = context.positions.get();
  const size: Size = { width: own.w, height: own.h };
  const spot: Point = freeSpot({ model, positions, size, start, ignore: request.ids });
  return { x: spot.x - own.x, y: spot.y - own.y };
}

/** Moves a state into another scope (or the top level), and next to its new siblings on the canvas. */
export function setParent(context: StateActionContext, id: string, scope: string | null): void {
  const model: StateModel | null = context.getModel();
  if (model === null || ops.setParent(model, id, scope) === model) {
    return;
  }
  const geometry: StateGeometry = stateGeometry(model, context.positions.get());
  const ids: string[] = [id, ...carriedBy(model, geometry, id)];
  const delta: Point | null = moveDelta(context, model, { id, scope, ids });
  if (delta !== null) {
    context.positions.move(ids, delta);
  }
  const where: string =
    scope === null ? 'the top level' : stateName(model, regionOf(model, scope)?.id ?? scope);
  run(context, (m) => [
    ops.setParent(m, id, scope),
    scope === null
      ? `Moved ${stateName(m, id)} to ${where}`
      : `Moved ${stateName(m, id)} into ${where}`,
  ]);
}

/** One item's move in a drag batch: where React Flow puts it now. */
export interface NodeMove {
  id: string;
  position: Point;
}

/** Positions with `ids` shifted by `delta` (ids without a spot stay as they are). */
export function shifted(positions: PositionMap, ids: readonly string[], delta: Point): PositionMap {
  const next: PositionMap = { ...positions };
  for (const id of ids) {
    const position: Position | undefined = Object.hasOwn(next, id) ? next[id] : undefined;
    if (position !== undefined) {
      next[id] = { ...position, x: position.x + delta.x, y: position.y + delta.y };
    }
  }
  return next;
}

interface DragBatch {
  model: StateModel;
  geometry: StateGeometry;
  /** Positions before the batch: a frame has none, so its box is where it was. */
  before: PositionMap;
  dragged: ReadonlySet<string>;
}

function applyMove(batch: DragBatch, positions: PositionMap, move: NodeMove): PositionMap {
  const isLeaf: boolean = Object.hasOwn(batch.before, move.id);
  const from: Point | undefined = isLeaf ? batch.before[move.id] : boxOf(batch.geometry, move.id);
  if (from === undefined) {
    return positions;
  }
  const delta: Point = { x: move.position.x - from.x, y: move.position.y - from.y };
  const carried: string[] = carriedBy(batch.model, batch.geometry, move.id).filter(
    (id: string) => !batch.dragged.has(id),
  );
  const placed: PositionMap = isLeaf
    ? { ...positions, [move.id]: { ...from, ...move.position } }
    : positions;
  return shifted(placed, carried, delta);
}

/**
 * Positions after a drag batch: dragged leaves go where React Flow puts them; a dragged frame or
 * state carries what is inside it and its notes, unless those are dragged too (v1's `onNodesChange`).
 */
export function draggedPositions(
  model: StateModel,
  positions: PositionMap,
  moves: readonly NodeMove[],
): PositionMap {
  const batch: DragBatch = {
    model,
    geometry: stateGeometry(model, positions),
    before: positions,
    dragged: new Set<string>(moves.map((move: NodeMove) => move.id)),
  };
  return moves.reduce(
    (next: PositionMap, move: NodeMove) => applyMove(batch, next, move),
    positions,
  );
}

/** Arrow-key nudges: the selected leaves and frames, with what they carry. */
export function nudgedIds(
  model: StateModel,
  positions: PositionMap,
  ids: readonly string[],
): string[] {
  const geometry: StateGeometry = stateGeometry(model, positions);
  return [...new Set<string>(ids.flatMap((id: string) => [id, ...carriedBy(model, geometry, id)]))];
}
