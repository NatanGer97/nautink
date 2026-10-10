import type { PaletteKind } from './state-types.ts';
import type { ReactElement } from 'react';

const BOX: string = 'fill-none stroke-current [stroke-width:1.5]';
const INK: string = 'fill-current';

/** The marks of each toolbar item, drawn in a 24 × 16 box (v1's `PaletteIcon`). */
const MARKS: Readonly<Record<PaletteKind, ReactElement>> = {
  state: <rect className={BOX} x="2" y="2" width="20" height="12" rx="4" />,
  start: <circle className={INK} cx="12" cy="8" r="5" />,
  end: (
    <g>
      <circle className={BOX} cx="12" cy="8" r="6" />
      <circle className={INK} cx="12" cy="8" r="3" />
    </g>
  ),
  choice: <polygon className={BOX} points="12,1.5 19,8 12,14.5 5,8" />,
  fork: (
    <g>
      <rect className={INK} x="4" y="6.5" width="16" height="3" rx="1" />
      <path className={BOX} d="M12,1 V6.5 M7,9.5 V15 M17,9.5 V15" />
    </g>
  ),
  join: (
    <g>
      <rect className={INK} x="4" y="6.5" width="16" height="3" rx="1" />
      <path className={BOX} d="M7,1 V6.5 M17,1 V6.5 M12,9.5 V15" />
    </g>
  ),
  composite: (
    <g>
      <rect className={BOX} x="1.5" y="1.5" width="21" height="13" rx="3" />
      <path className={BOX} d="M1.5,5.5 H22.5" />
      <rect className={BOX} x="8" y="8" width="8" height="4" rx="1.5" />
    </g>
  ),
  note: (
    <g className={BOX}>
      <path d="M6,1.5 H15 L18,4.5 V14.5 H6 Z" />
      <path d="M15,1.5 V4.5 H18" />
    </g>
  ),
};

/** A small picture of a state diagram item for the toolbar. */
export function PaletteIcon({ kind }: { kind: PaletteKind }): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 16" className="size-5">
      {MARKS[kind]}
    </svg>
  );
}
