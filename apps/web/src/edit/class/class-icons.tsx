import { cn } from '@nautink/ui/lib/utils';

import type { PaletteKind } from './class-palette.ts';
import type { RelationKind } from '@nautink/editors/class/model';
import type { ReactElement } from 'react';

const TAGS: Readonly<Partial<Record<PaletteKind, string>>> = {
  interface: 'I',
  abstract: 'A',
  enumeration: 'E',
};

const LINE: string = 'fill-none stroke-current [stroke-width:1.2]';
const BOX: string = 'fill-node-fill stroke-current [stroke-width:1.3]';

/** A toolbar tile: a small class box (tagged I, A or E) or a note (v1's PaletteIcon). */
export function PaletteIcon({ kind }: { kind: PaletteKind }): ReactElement {
  if (kind === 'note') {
    return (
      <svg aria-hidden="true" viewBox="0 0 26 22" className="size-[22px]">
        <path
          d="M3,2 H17 L23,8 V20 H3 Z"
          className="fill-warning-bg stroke-warning [stroke-width:1.3]"
        />
        <path d="M17,2 V8 H23" className="fill-none stroke-warning [stroke-width:1.2]" />
      </svg>
    );
  }
  const tag: string | undefined = TAGS[kind];
  return (
    <svg aria-hidden="true" viewBox="0 0 26 22" className="size-[22px]">
      <rect x="2" y="1.5" width="22" height="19" rx="2" className={BOX} />
      <line x1="2" y1="8" x2="24" y2="8" className={LINE} />
      {tag === undefined ? (
        <line x1="2" y1="14" x2="24" y2="14" className={LINE} />
      ) : (
        <text
          x="13"
          y="17.5"
          textAnchor="middle"
          className={cn('fill-current text-[9px] font-semibold', kind === 'abstract' && 'italic')}
        >
          {tag}
        </text>
      )}
    </svg>
  );
}

/** The kind preview's line ends: after a start diamond, before an end marker, or full width. */
const LINE_START: number = 2;
const AFTER_DIAMOND: number = 13;
const BEFORE_MARKER: number = 21;
const LINE_END: number = 32;

const HOLLOW: string = 'fill-panel stroke-current [stroke-width:1.2]';

function KindMark({ mark }: { mark: RelationKind['mark'] }): ReactElement | null {
  if (mark === 'ext') {
    return <path d="M21,2 L32,7 L21,12 Z" className={HOLLOW} />;
  }
  if (mark === 'dep') {
    return (
      <path d="M24,2.5 L32,7 L24,11.5" className="fill-none stroke-current [stroke-width:1.3]" />
    );
  }
  if (mark === 'comp') {
    return (
      <path
        d="M2,7 L7.5,3 L13,7 L7.5,11 Z"
        className="fill-current stroke-current [stroke-width:1.2]"
      />
    );
  }
  return mark === 'agg' ? <path d="M2,7 L7.5,3 L13,7 L7.5,11 Z" className={HOLLOW} /> : null;
}

/** A small preview of a relation kind: its line and end marker (v1's KindIcon). */
export function KindIcon({ kind }: { kind: RelationKind }): ReactElement {
  const isAtStart: boolean = kind.side === 1;
  const dash: string | undefined = kind.line === 'dashed' ? '3 2' : undefined;
  const x1: number = isAtStart ? AFTER_DIAMOND : LINE_START;
  const x2: number = kind.mark === 'none' || isAtStart ? LINE_END : BEFORE_MARKER;
  return (
    <svg aria-hidden="true" width="34" height="14" className="shrink-0 text-edge">
      <line
        x1={x1}
        y1="7"
        x2={x2}
        y2="7"
        strokeDasharray={dash}
        className="stroke-current [stroke-width:1.3]"
      />
      <KindMark mark={kind.mark} />
    </svg>
  );
}
