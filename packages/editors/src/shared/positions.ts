import type { Rect, Size } from '@nautink/visual-core/geometry';
import type { Position, PositionMap } from '@nautink/visual-core/positions';

/** The stored position of `id`, ignoring inherited object keys such as `constructor`. */
export function positionOf(positions: PositionMap, id: string): Position | undefined {
  return Object.hasOwn(positions, id) ? positions[id] : undefined;
}

/** A box from a position and a size. */
export function rectAt(position: Position, size: Size): Rect {
  return { x: position.x, y: position.y, w: size.width, h: size.height };
}

/** Result of placing items after the model changed from outside (code edit, Claude). */
export interface Placement {
  positions: PositionMap;
  isFullLayout: boolean;
}
