import { fitView, IDENTITY_VIEW, panBy, wheelZoomFactor, zoomAt } from './view-math.ts';
import { NO_INSETS } from '../lib/fit-insets.ts';

import type { Point, Size, ViewTransform } from './view-math.ts';
import type { FitInsets } from '../lib/fit-insets.ts';

/** A press that moves less than this is a click, not a pan. */
const DRAG_THRESHOLD_PX: number = 4;
const HALF: number = 0.5;

interface Drag {
  start: Point;
  target: EventTarget | null;
  view: ViewTransform;
  isMoved: boolean;
}

/** One wheel event, in viewport pixels. */
export interface WheelInput {
  at: Point;
  deltaX: number;
  deltaY: number;
  /** ⌘ or Ctrl held, or a trackpad pinch (which browsers report as Ctrl + wheel). */
  isZoom: boolean;
}

/**
 * The preview's pan, zoom and fit, outside React (v1's `Preview.jsx`). The view follows the diagram
 * (stays fitted as the code or the window changes) until the user pans or zooms by hand.
 */
export class ViewController {
  private view: ViewTransform = IDENTITY_VIEW;
  private isFollowing: boolean = true;
  private viewport: Size = { width: 0, height: 0 };
  private content: Size = { width: 0, height: 0 };
  private insets: FitInsets = NO_INSETS;
  private drag: Drag | null = null;
  private readonly listeners: Set<() => void> = new Set<() => void>();

  getView = (): ViewTransform => this.view;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Fits now and follows the diagram from here on. */
  fit = (): void => {
    this.isFollowing = true;
    this.publish(fitView(this.content, this.viewport, this.insets));
  };

  /** A different diagram: fit it once it has a size. */
  follow(): void {
    this.isFollowing = true;
  }

  setViewport(size: Size): void {
    this.viewport = size;
    this.refit();
  }

  /** Room to keep free at the top and bottom (the floating bars); refits while following. */
  setInsets(insets: FitInsets): void {
    this.insets = insets;
    this.refit();
  }

  setContent(size: Size): void {
    this.content = size;
    this.refit();
  }

  /** Zooms around the viewport's center (buttons and commands). */
  zoomBy = (factor: number): void => {
    const center: Point = { x: this.viewport.width * HALF, y: this.viewport.height * HALF };
    this.manual(zoomAt(this.view, factor, center));
  };

  /** Scroll pans; ⌘/Ctrl + scroll zooms around the cursor. */
  wheel(input: WheelInput): void {
    this.manual(
      input.isZoom
        ? zoomAt(this.view, wheelZoomFactor(input.deltaY), input.at)
        : panBy(this.view, -input.deltaX, -input.deltaY),
    );
  }

  /** Starts a press on `target` (whatever is under the pointer). */
  pointerDown(at: Point, target: EventTarget | null): void {
    this.drag = { start: at, target, view: this.view, isMoved: false };
  }

  pointerMove(at: Point): void {
    const drag: Drag | null = this.drag;
    if (drag === null) {
      return;
    }
    const dx: number = at.x - drag.start.x;
    const dy: number = at.y - drag.start.y;
    if (drag.isMoved || Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
      this.drag = { ...drag, isMoved: true };
      this.manual(panBy(drag.view, dx, dy));
    }
  }

  /** Ends a press. Returns the pressed target when it was a click (it never moved enough to pan). */
  pointerUp(): EventTarget | null {
    const drag: Drag | null = this.drag;
    this.drag = null;
    return drag === null || drag.isMoved ? null : drag.target;
  }

  private refit(): void {
    if (this.isFollowing) {
      this.publish(fitView(this.content, this.viewport, this.insets));
    }
  }

  private manual(view: ViewTransform): void {
    this.isFollowing = false;
    this.publish(view);
  }

  private publish(view: ViewTransform): void {
    this.view = view;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
