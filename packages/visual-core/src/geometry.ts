const MAX_RINGS: number = 40;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** A box on the canvas: top-left corner, width and height. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Do two boxes overlap, or come closer than `gap`? */
export function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
  );
}

/** Offsets on the square ring `ring` steps away from the centre, in v1's search order. */
function* ringOffsets(ring: number): Generator<readonly [number, number]> {
  for (let i: number = -ring; i <= ring; i++) {
    yield [i, -ring];
    yield [i, ring];
    yield [-ring, i];
    yield [ring, i];
  }
}

export interface FreeSpotRequest {
  rects: readonly Rect[];
  size: Size;
  start: Point;
  gap: number;
  step: number;
}

/** Nearest top-left point to `start` where a box of `size` overlaps none of `rects`. */
export function findFreeSpot({ rects, size, start, gap, step }: FreeSpotRequest): Point {
  const fits = (point: Point): boolean =>
    !rects.some((other: Rect) => overlaps({ ...point, w: size.width, h: size.height }, other, gap));
  if (fits(start)) {
    return start;
  }
  for (let ring: number = 1; ring < MAX_RINGS; ring++) {
    for (const [dx, dy] of ringOffsets(ring)) {
      const point: Point = { x: start.x + dx * step, y: start.y + dy * step };
      if (fits(point)) {
        return point;
      }
    }
  }
  return start;
}
