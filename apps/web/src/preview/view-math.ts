/** Where the diagram sits in the viewport: translate by (x, y), then scale by k. */
export interface ViewTransform {
  x: number;
  y: number;
  k: number;
}

export interface Size {
  width: number;
  height: number;
}

/** A point in viewport pixels. */
export interface Point {
  x: number;
  y: number;
}

export const IDENTITY_VIEW: ViewTransform = { x: 0, y: 0, k: 1 };

/** v1's limits: 10 % to 800 %, and a fit never enlarges past 200 %. */
export const MIN_ZOOM: number = 0.1;
export const MAX_ZOOM: number = 8;
const MAX_FIT_ZOOM: number = 2;
/** Room left around a fitted diagram, in pixels (both sides together). */
const FIT_PADDING: number = 48;
/** One zoom button press or command. */
export const ZOOM_STEP: number = 1.2;
/** How strongly a ⌘/Ctrl + wheel tick zooms. */
const WHEEL_ZOOM_RATE: number = 0.01;
const PERCENT: number = 100;
const HALF: number = 0.5;

export function clampZoom(k: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));
}

/** The view that centers `content` in `viewport`, as large as fits. Identity when either is empty. */
export function fitView(content: Size, viewport: Size): ViewTransform {
  const isMeasurable: boolean =
    content.width > 0 && content.height > 0 && viewport.width > 0 && viewport.height > 0;
  if (!isMeasurable) {
    return IDENTITY_VIEW;
  }
  const k: number = clampZoom(
    Math.min(
      (viewport.width - FIT_PADDING) / content.width,
      (viewport.height - FIT_PADDING) / content.height,
      MAX_FIT_ZOOM,
    ),
  );
  return {
    k,
    x: (viewport.width - content.width * k) * HALF,
    y: (viewport.height - content.height * k) * HALF,
  };
}

/** Zooms by `factor` keeping the viewport point `at` still under the cursor. */
export function zoomAt(view: ViewTransform, factor: number, at: Point): ViewTransform {
  const k: number = clampZoom(view.k * factor);
  const ratio: number = k / view.k;
  return { k, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio };
}

export function panBy(view: ViewTransform, dx: number, dy: number): ViewTransform {
  return { ...view, x: view.x + dx, y: view.y + dy };
}

/** The zoom factor for one ⌘/Ctrl + wheel event: scrolling up zooms in. */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * WHEEL_ZOOM_RATE);
}

/** "100%" for k = 1. */
export function zoomLabel(k: number): string {
  return `${String(Math.round(k * PERCENT))}%`;
}

/** The CSS transform that places the diagram. */
export function viewTransformCss(view: ViewTransform): string {
  return `translate(${String(view.x)}px, ${String(view.y)}px) scale(${String(view.k)})`;
}

const VIEW_BOX_PARTS: number = 4;

/** The width and height in a `viewBox` attribute; zero when there is none. */
export function viewBoxSize(viewBox: string | null): Size {
  const parts: number[] = (viewBox ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [, , width = 0, height = 0] = parts;
  const isValid: boolean = parts.length === VIEW_BOX_PARTS && width > 0 && height > 0;
  return isValid ? { width, height } : { width: 0, height: 0 };
}
