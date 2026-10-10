// Pan, zoom and fit for the sequence canvas, as the other editors do them (React Flow's limits and
// the shared fit: 24 px padding, at most 120 %, the prompt bar's room kept free at the bottom).
import type { Point, Size, ViewTransform } from '../../preview/view-math.ts';
import type { SequenceLayout } from '@nautink/editors/sequence/layout';

const MIN_ZOOM: number = 0.1;
const MAX_ZOOM: number = 3;
const FIT_PADDING_PX: number = 24;
/** Padding on both sides. */
const FIT_PADDINGS_PX: number = FIT_PADDING_PX + FIT_PADDING_PX;
const WHEEL_BASE: number = 2;
const FIT_MAX_ZOOM: number = 1.2;
const HALF: number = 0.5;
const WHEEL_RATE: number = 0.002;

export const START_VIEW: ViewTransform = { x: 0, y: 0, k: 1 };

/** The part of the layout the view needs: the drawing's left edge, right edge and height. */
export type CanvasBounds = Pick<SequenceLayout, 'minX' | 'width' | 'height'>;

export function clampZoom(k: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));
}

/** The view that shows the whole diagram, centred above the prompt bar's room. */
export function fitSequence(
  bounds: CanvasBounds,
  viewport: Size,
  bottomInset: number,
): ViewTransform {
  const width: number = bounds.width - bounds.minX;
  const roomW: number = viewport.width - FIT_PADDINGS_PX;
  const roomH: number = viewport.height - bottomInset - FIT_PADDINGS_PX;
  if (width <= 0 || bounds.height <= 0 || roomW <= 0 || roomH <= 0) {
    return START_VIEW;
  }
  const k: number = clampZoom(Math.min(roomW / width, roomH / bounds.height, FIT_MAX_ZOOM));
  return {
    k,
    x: (viewport.width - width * k) * HALF,
    y: FIT_PADDING_PX + (roomH - bounds.height * k) * HALF,
  };
}

/** Zooms by `factor`, keeping the viewport point `at` still. */
export function zoomAround(view: ViewTransform, factor: number, at: Point): ViewTransform {
  const k: number = clampZoom(view.k * factor);
  const ratio: number = k / view.k;
  return { k, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio };
}

/** A wheel tick's zoom factor: scrolling up zooms in (React Flow's default wheel). */
export function wheelFactor(deltaY: number): number {
  return WHEEL_BASE ** (-deltaY * WHEEL_RATE);
}

/** A viewport point (pixels from its top-left corner) in canvas coordinates. */
export function toCanvasPoint(point: Point, view: ViewTransform, minX: number): Point {
  return { x: (point.x - view.x) / view.k + minX, y: (point.y - view.y) / view.k };
}

/** The CSS transform of the stage that holds the drawing. */
export function stageTransform(view: ViewTransform): string {
  return `translate(${String(view.x)}px, ${String(view.y)}px) scale(${String(view.k)})`;
}

/** Zooms around the middle of the viewport (the zoom buttons). */
export function zoomCentered(view: ViewTransform, factor: number, viewport: Size): ViewTransform {
  return zoomAround(view, factor, { x: viewport.width * HALF, y: viewport.height * HALF });
}
