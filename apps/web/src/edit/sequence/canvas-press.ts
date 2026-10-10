import { isPastThreshold } from './sequence-drag.ts';

import type { DragSession, DragStart } from './sequence-drag.ts';
import type { Point } from '../../preview/view-math.ts';

/** The one press in progress on the canvas, kept outside React (pointer events come fast). */
export class CanvasPress {
  #session: DragSession | null = null;

  /** Starts a press at `origin` (canvas) / `client` (screen). */
  start(from: DragStart, origin: Point, client: Point): void {
    this.#session = { start: from, origin, client, isMoved: false };
  }

  /** The press once the pointer has moved far enough to be a drag; null before that or with none. */
  move(client: Point): DragSession | null {
    const session: DragSession | null = this.#session;
    if (session === null || !isPastThreshold(session, client)) {
      return null;
    }
    this.#session = { ...session, isMoved: true };
    return this.#session;
  }

  /** Ends the press and returns it (null when there was none). */
  end(): DragSession | null {
    const session: DragSession | null = this.#session;
    this.#session = null;
    return session;
  }
}
