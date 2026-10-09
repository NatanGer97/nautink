import type { ReactElement } from 'react';

export const CIRCLE_MARKER: string = 'nautink-flow-circle';
export const CROSS_MARKER: string = 'nautink-flow-cross';

/** Link ends React Flow has no marker for: `--o` (circle) and `--x` (cross). */
export function FlowMarkers(): ReactElement {
  return (
    <svg aria-hidden="true" className="absolute size-0">
      <defs>
        <marker
          id={CIRCLE_MARKER}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="9"
          markerHeight="9"
          orient="auto"
        >
          <circle cx="5" cy="5" r="4" className="fill-panel stroke-edge [stroke-width:1.5]" />
        </marker>
        <marker
          id={CROSS_MARKER}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="10"
          markerHeight="10"
          orient="auto"
        >
          <path d="M1,1 L9,9 M9,1 L1,9" className="fill-none stroke-edge [stroke-width:1.5]" />
        </marker>
      </defs>
    </svg>
  );
}
