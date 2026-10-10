// Participant glyphs (the UML symbols) on the canvas and as tool icons, and the arrow previews of
// the inspector (v1's shapes.jsx), drawn with token colors.
import { cn } from '@nautink/ui/lib/utils';

import { svg, translate } from './svg-path.ts';

import type { HeadKind, LineStyle, ParticipantKind } from '@nautink/editors/sequence/types';
import type { ReactElement } from 'react';

const HALF: number = 0.5;
const SOLID: string = 'fill-node-fill stroke-node-stroke [stroke-width:1.4]';
const LINE: string = 'fill-none stroke-node-stroke [stroke-width:1.6] [stroke-linecap:round]';

/** Where a glyph goes: centred on `cx`, its top at `top`, `w` wide. */
export interface GlyphBox {
  cx: number;
  top: number;
  w: number;
}

// Fixed-size glyphs, drawn around (0, 0) = the middle of their top edge.
const FIXED: Readonly<Partial<Record<ParticipantKind, ReactElement>>> = {
  actor: (
    <>
      <circle cx="0" cy="9" r="7" className={SOLID} />
      <path className={LINE} d="M0,16 V32 M-13,21 H13 M0,32 L-10,45 M0,32 L10,45" />
    </>
  ),
  boundary: (
    <>
      <path className={LINE} d="M-18,3 V31 M-18,17 H-7" />
      <circle cx="6" cy="17" r="13" className={SOLID} />
    </>
  ),
  control: (
    <>
      <circle cx="0" cy="18" r="13" className={SOLID} />
      <path className={LINE} d="M5,0.5 L-1,5 L5,9.5" />
    </>
  ),
  entity: (
    <>
      <circle cx="0" cy="15" r="13" className={SOLID} />
      <path className={LINE} d="M-14,31 H14" />
    </>
  ),
};

const CAP: number = 9;
const STACK: number = 6;

function databaseGlyph(half: number): ReactElement {
  return (
    <>
      <path className={SOLID} d={svg`M${-half},7 V43 A${half},7 0 0,0 ${half},43 V7`} />
      <ellipse className={SOLID} cx="0" cy="7" rx={half} ry="7" />
    </>
  );
}

function collectionsGlyph(half: number): ReactElement {
  const width: number = half + half - STACK;
  return (
    <>
      <rect className={SOLID} x={-half + STACK} y="0" width={width} height="40" rx="3" />
      <rect className={SOLID} x={-half} y="6" width={width} height="40" rx="3" />
    </>
  );
}

function queueGlyph(half: number): ReactElement {
  const left: number = -half + CAP;
  const right: number = half - CAP;
  return (
    <>
      <path
        className={SOLID}
        d={svg`M${left},0 H${right} A9,21 0 0,1 ${right},42 H${left} A9,21 0 0,1 ${left},0 Z`}
      />
      <path className={SOLID} d={svg`M${right},0 A9,21 0 0,0 ${right},42`} />
    </>
  );
}

function sizedGlyph(kind: ParticipantKind, half: number): ReactElement {
  switch (kind) {
    case 'database':
      return databaseGlyph(half);
    case 'collections':
      return collectionsGlyph(half);
    case 'queue':
      return queueGlyph(half);
    default:
      return <rect className={SOLID} x={-half} y="0" width={half + half} height="40" rx="4" />;
  }
}

/** A participant's glyph on the canvas. Selected glyphs are drawn in the accent by their group. */
export function Glyph({ kind, box }: { kind: ParticipantKind; box: GlyphBox }): ReactElement {
  return (
    <g transform={translate(box.cx, box.top)}>{FIXED[kind] ?? sizedGlyph(kind, box.w * HALF)}</g>
  );
}

const ICON_PATHS: Readonly<Record<ParticipantKind, ReactElement>> = {
  participant: <rect x="3" y="7" width="18" height="10" rx="2" />,
  actor: (
    <path
      className="fill-none"
      d="M12,3.5 a3,3 0 1,0 0.01,0 M12,9.5 V15 M6,11.5 H18 M12,15 L7.5,21 M12,15 L16.5,21"
    />
  ),
  boundary: (
    <>
      <path className="fill-none" d="M3,6 V18 M3,12 H8" />
      <circle cx="14" cy="12" r="6" />
    </>
  ),
  control: (
    <>
      <circle cx="12" cy="13" r="7" />
      <path className="fill-none" d="M14.5,3.5 L11,6 L14.5,8.5" />
    </>
  ),
  entity: (
    <>
      <circle cx="12" cy="10" r="6.5" />
      <path className="fill-none" d="M5,19.5 H19" />
    </>
  ),
  database: (
    <>
      <path d="M5,6 V18 A7,2.6 0 0,0 19,18 V6" />
      <ellipse cx="12" cy="6" rx="7" ry="2.6" />
    </>
  ),
  collections: (
    <>
      <rect x="6" y="4" width="14" height="11" rx="1.5" />
      <rect x="3" y="8" width="14" height="11" rx="1.5" />
    </>
  ),
  queue: (
    <>
      <path d="M6,7 H18 A2.5,5 0 0,1 18,17 H6 A2.5,5 0 0,1 6,7 Z" />
      <path className="fill-none" d="M18,7 A2.5,5 0 0,0 18,17" />
    </>
  ),
};

/** A participant kind as a 16 px tool icon (toolbar, library, inspector). */
export function KindIcon({
  kind,
  size = 16,
}: {
  kind: ParticipantKind;
  size?: number;
}): ReactElement {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="overflow-visible fill-node-fill stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.6]"
    >
      {ICON_PATHS[kind]}
    </svg>
  );
}

const ARROW_HEADS: Readonly<Partial<Record<HeadKind, ReactElement>>> = {
  arrow: <path d="M22,6 L28,9 L22,12 Z" className="fill-current stroke-none" />,
  cross: <path d="M22,5 L28,13 M28,5 L22,13" />,
  async: <path d="M22,5 L28,9 L22,13" />,
  bi: (
    <>
      <path d="M22,6 L28,9 L22,12 Z" className="fill-current stroke-none" />
      <path d="M8,6 L2,9 L8,12 Z" className="fill-current stroke-none" />
    </>
  ),
};

/** A small arrow preview for the inspector's arrowhead choices. */
export function ArrowIcon({ line, head }: { line: LineStyle; head: HeadKind }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="30"
      height="18"
      viewBox="0 0 30 18"
      className="fill-none stroke-current [stroke-width:1.4]"
    >
      <path d="M2,9 H27" className={cn(line === 'dotted' && '[stroke-dasharray:3_2]')} />
      {ARROW_HEADS[head] ?? null}
    </svg>
  );
}
