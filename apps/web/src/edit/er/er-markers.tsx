// Crow's-foot link ends (v1's `Markers`, `CardGlyph`, `CardIcon`). Each glyph is drawn in a 26 × 20
// box: the line arrives from the left and the entity's border is at x = 26. React Flow ends a link
// at the outer edge of its handle, 4 px outside the node, hence refX = 22.
import { cn } from '@nautink/ui/lib/utils';

import type { Cardinality } from '@nautink/editors/er/model';
import type { ReactElement } from 'react';

const WIDTH: number = 26;
const HEIGHT: number = 20;
const MIDDLE: number = 10;
const BAR_HALF: number = 7;
const CIRCLE_R: number = 4.5;
const HANDLE_OVERHANG: number = 4;
const ICON_LEAD: number = 8;
const CUP_DEPTH: number = 6;
const ALL_CARDS: readonly Cardinality[] = [
  'ZERO_OR_ONE',
  'ONLY_ONE',
  'ZERO_OR_MORE',
  'ONE_OR_MORE',
  'MD_PARENT',
];

const STROKE: string = 'fill-none [stroke-linecap:round] [stroke-width:1.5]';

function Bar({ x }: { x: number }): ReactElement {
  return <line x1={x} y1={MIDDLE - BAR_HALF} x2={x} y2={MIDDLE + BAR_HALF} />;
}

function Ring({ x }: { x: number }): ReactElement {
  return <circle cx={x} cy={MIDDLE} r={CIRCLE_R} className="fill-background" />;
}

function Crow({ x }: { x: number }): ReactElement {
  return (
    <path
      d={`M${String(x)},${String(MIDDLE)} L${String(WIDTH)},${String(MIDDLE - BAR_HALF)} M${String(x)},${String(MIDDLE)} L${String(WIDTH)},${String(MIDDLE + BAR_HALF)}`}
    />
  );
}

const GLYPHS: Readonly<Record<Cardinality, ReactElement>> = {
  ZERO_OR_ONE: (
    <>
      <Ring x={8} />
      <Bar x={18} />
    </>
  ),
  ONLY_ONE: (
    <>
      <Bar x={13} />
      <Bar x={19} />
    </>
  ),
  ZERO_OR_MORE: (
    <>
      <Ring x={7} />
      <Crow x={14} />
    </>
  ),
  ONE_OR_MORE: (
    <>
      <Bar x={10} />
      <Crow x={14} />
    </>
  ),
  MD_PARENT: (
    <>
      <Bar x={18} />
      <path d={`M8,${String(MIDDLE - CUP_DEPTH)} v6 a3,3 0 0 0 6,0 v-6`} />
    </>
  ),
};

/** The glyph for one cardinality, with the entity on its right. */
export function CardGlyph({ card }: { card: Cardinality }): ReactElement {
  return GLYPHS[card];
}

/** The id of the marker for one cardinality, drawn in the accent colour when selected. */
export function markerId(card: Cardinality, isSelected: boolean): string {
  return `nautink-er-${card}${isSelected ? '-selected' : ''}`;
}

function strokeClass(isSelected: boolean): string {
  return cn(STROKE, isSelected ? 'stroke-accent-ink' : 'stroke-edge');
}

/** Every crow's-foot marker, plain and selected, for the relationship lines to point at. */
export function ErMarkers(): ReactElement {
  return (
    <svg aria-hidden="true" className="absolute size-0">
      <defs>
        {[false, true].flatMap((isSelected) =>
          ALL_CARDS.map((card) => (
            <marker
              key={markerId(card, isSelected)}
              id={markerId(card, isSelected)}
              viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
              refX={WIDTH - HANDLE_OVERHANG}
              refY={MIDDLE}
              markerWidth={WIDTH}
              markerHeight={HEIGHT}
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <g className={strokeClass(isSelected)}>
                <line x1="0" y1={MIDDLE} x2={WIDTH} y2={MIDDLE} />
                <CardGlyph card={card} />
              </g>
            </marker>
          )),
        )}
      </defs>
    </svg>
  );
}

/** A small preview of one end, entity wall on the right, for the inspector's cardinality picker. */
export function CardIcon({ card }: { card: Cardinality }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      width={WIDTH + ICON_LEAD}
      height={HEIGHT}
      viewBox={`-${String(ICON_LEAD)} 0 ${String(WIDTH + ICON_LEAD)} ${String(HEIGHT)}`}
      className="shrink-0"
    >
      <g className={strokeClass(false)}>
        <line x1={-ICON_LEAD} y1={MIDDLE} x2={WIDTH} y2={MIDDLE} />
        <CardGlyph card={card} />
        <line
          x1={WIDTH}
          y1="1"
          x2={WIDTH}
          y2={HEIGHT - 1}
          className="stroke-node-stroke [stroke-width:2.5]"
        />
      </g>
    </svg>
  );
}
