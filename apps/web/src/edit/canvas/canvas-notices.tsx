import { VIEWING_VERSION } from '../read-only-reason.ts';

import type { ReactElement } from 'react';

/**
 * Says why the canvas is read-only (Claude is editing, a syntax error). An older version on view
 * already has its own bar, so it gets no banner.
 */
export function ReadOnlyBanner({ reason }: { reason: string | null }): ReactElement | null {
  if (reason === null || reason === VIEWING_VERSION) {
    return null;
  }
  return (
    <p
      role="status"
      className="absolute top-4 left-1/2 z-10 max-w-[min(420px,calc(100%-32px))] -translate-x-1/2 rounded-card border bg-panel px-3 py-1.5 text-center text-xs text-muted-foreground shadow-float"
    >
      {reason}
    </p>
  );
}

/** A quiet hint in the middle of an empty canvas ("Drag a shape from the toolbar to start"). */
export function CanvasHint({ text }: { text: string }): ReactElement {
  return (
    <p className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 text-center text-muted-foreground">
      {text}
    </p>
  );
}
