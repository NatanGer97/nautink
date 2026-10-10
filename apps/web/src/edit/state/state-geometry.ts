// Where things are on the state canvas (v1's StateEditor `geo`, `boxes`, `scopeAt`, `placeAt`):
// leaves and frames from the model, their boxes from the positions, and the scope under a point.
import { computeBoxes, frames, freeSpot, leaves } from '@nautink/editors/state/layout';
import { regionScope, scopeInsideState, scopeWithin } from '@nautink/editors/state/scopes';
import { nodeSize } from '@nautink/editors/state/size';

import type { Frame, Leaf } from '@nautink/editors/state/layout';
import type { LeafData } from '@nautink/editors/state/size';
import type { StateModel } from '@nautink/editors/state/types';
import type { Point, Rect, Size } from '@nautink/visual-core/geometry';
import type { PositionMap } from '@nautink/visual-core/positions';

const HALF: number = 0.5;

export interface StateGeometry {
  leaves: Leaf[];
  /** Deepest first, as boxes are computed. */
  frames: Frame[];
  boxes: Record<string, Rect>;
}

/** Leaves, frames and every box, for one model and its positions. */
export function stateGeometry(model: StateModel, positions: PositionMap): StateGeometry {
  const { list, isNonEmpty } = leaves(model);
  const frameList: Frame[] = frames(model, isNonEmpty);
  return {
    leaves: list,
    frames: frameList,
    boxes: computeBoxes({ leaves: list, frames: frameList, positions }),
  };
}

export function boxOf(geometry: StateGeometry, id: string): Rect | undefined {
  return Object.hasOwn(geometry.boxes, id) ? geometry.boxes[id] : undefined;
}

export function isInside(point: Point, box: Rect | undefined): boolean {
  return (
    box !== undefined &&
    point.x >= box.x &&
    point.x <= box.x + box.w &&
    point.y >= box.y &&
    point.y <= box.y + box.h
  );
}

function frameScopeAt(geometry: StateGeometry, point: Point): string | null {
  for (const frame of geometry.frames) {
    const isHit: boolean = isInside(point, boxOf(geometry, frame.id));
    const hasRegions: boolean = frame.kind === 'composite' && frame.regions > 0;
    if (isHit && !hasRegions) {
      return frame.id;
    }
  }
  const owner: Frame | undefined = geometry.frames.find(
    (frame: Frame) =>
      frame.kind === 'composite' && frame.regions > 0 && isInside(point, boxOf(geometry, frame.id)),
  );
  return owner === undefined ? null : regionScope(owner.id, 0);
}

/** The innermost scope (empty composite, region or composite) under a canvas point, or null. */
export function scopeAt(geometry: StateGeometry, point: Point): string | null {
  const empty: Leaf | undefined = geometry.leaves.find(
    (leaf: Leaf) =>
      leaf.data.kind === 'emptyComposite' && isInside(point, boxOf(geometry, leaf.id)),
  );
  return empty === undefined ? frameScopeAt(geometry, point) : empty.id;
}

/** Room kept around a new item (the frame of a new composite around its first child). */
export interface Margin {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const NO_MARGIN: Margin = { left: 0, top: 0, right: 0, bottom: 0 };

export interface PlaceRequest {
  model: StateModel;
  positions: PositionMap;
  data: LeafData;
  /** Where the item's centre should go. */
  at: Point;
  /** The scope it goes into: frames it is not inside are kept clear. */
  scope: string | null;
  margin?: Margin;
}

/** Boxes of the frames `scope` is not inside: a new item there must stay out of them. */
function foreignFrames(model: StateModel, geometry: StateGeometry, scope: string | null): Rect[] {
  return geometry.frames
    .filter((frame: Frame) => !scopeWithin(model, scope, frame.id))
    .flatMap((frame: Frame) => boxOf(geometry, frame.id) ?? []);
}

/** A free top-left spot for a new item near `at`, clear of other items and of foreign frames. */
export function placeAt({
  model,
  positions,
  data,
  at,
  scope,
  margin = NO_MARGIN,
}: PlaceRequest): Point {
  const size: Size = nodeSize(data);
  const outer: Size = {
    width: size.width + margin.left + margin.right,
    height: size.height + margin.top + margin.bottom,
  };
  const extra: Rect[] = foreignFrames(model, stateGeometry(model, positions), scope);
  const start: Point = { x: at.x - outer.width * HALF, y: at.y - outer.height * HALF };
  const spot: Point = freeSpot({ model, positions, size: outer, start, extra });
  return { x: spot.x + margin.left, y: spot.y + margin.top };
}

/** Leaves that move with `id`: everything inside it (a composite), and the notes on it. */
export function carriedBy(model: StateModel, geometry: StateGeometry, id: string): string[] {
  return geometry.leaves
    .filter(
      (leaf: Leaf) =>
        leaf.id !== id &&
        (scopeInsideState(model, leaf.scope, id) ||
          (leaf.data.kind === 'note' && leaf.data.target === id)),
    )
    .map((leaf: Leaf) => leaf.id);
}
