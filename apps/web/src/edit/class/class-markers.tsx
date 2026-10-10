import type { ClassMark } from '@nautink/editors/class/types';
import type { ReactElement } from 'react';

const MARKER_IDS: Readonly<Partial<Record<ClassMark, string>>> = {
  ext: 'nautink-cls-ext',
  comp: 'nautink-cls-comp',
  agg: 'nautink-cls-agg',
  dep: 'nautink-cls-dep',
};

/** The `url(#…)` of a relation end's marker, or undefined for a plain end. */
export function markerUrl(mark: ClassMark, isSelected: boolean): string | undefined {
  const id: string | undefined = MARKER_IDS[mark];
  if (id === undefined) {
    return undefined;
  }
  const suffix: string = isSelected ? '-sel' : '';
  return `url(#${id}${suffix})`;
}

const HOLLOW: string = 'fill-panel [stroke-linejoin:round] [stroke-width:1.4]';
const SOLID: string = '[stroke-linejoin:round] [stroke-width:1.2]';
const OPEN: string = 'fill-none [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]';

function MarkerSet({ suffix, ink }: { suffix: string; ink: string }): ReactElement {
  const fillInk: string =
    ink === 'stroke-edge' ? 'fill-edge stroke-edge' : 'fill-accent-ink stroke-accent-ink';
  return (
    <>
      <marker
        id={`nautink-cls-ext${suffix}`}
        viewBox="0 0 16 14"
        refX="15.5"
        refY="7"
        markerWidth="16"
        markerHeight="14"
        markerUnits="userSpaceOnUse"
        orient="auto-start-reverse"
      >
        <path d="M1,1 L15.5,7 L1,13 Z" className={`${HOLLOW} ${ink}`} />
      </marker>
      <marker
        id={`nautink-cls-comp${suffix}`}
        viewBox="0 0 20 12"
        refX="19.5"
        refY="6"
        markerWidth="20"
        markerHeight="12"
        markerUnits="userSpaceOnUse"
        orient="auto-start-reverse"
      >
        <path d="M0.5,6 L10,1 L19.5,6 L10,11 Z" className={`${SOLID} ${fillInk}`} />
      </marker>
      <marker
        id={`nautink-cls-agg${suffix}`}
        viewBox="0 0 20 12"
        refX="19.5"
        refY="6"
        markerWidth="20"
        markerHeight="12"
        markerUnits="userSpaceOnUse"
        orient="auto-start-reverse"
      >
        <path d="M0.5,6 L10,1 L19.5,6 L10,11 Z" className={`${HOLLOW} ${ink}`} />
      </marker>
      <marker
        id={`nautink-cls-dep${suffix}`}
        viewBox="0 0 14 14"
        refX="13"
        refY="7"
        markerWidth="14"
        markerHeight="14"
        markerUnits="userSpaceOnUse"
        orient="auto-start-reverse"
      >
        <path d="M1,1.5 L13,7 L1,12.5" className={`${OPEN} ${ink}`} />
      </marker>
    </>
  );
}

/**
 * UML end markers (v1's Markers): triangle, filled and hollow diamonds, open arrow. Drawn pointing
 * along +x with the tip at the line end; `auto-start-reverse` flips them at a path's start.
 */
export function ClassMarkers(): ReactElement {
  return (
    <svg aria-hidden="true" className="absolute size-0">
      <defs>
        <MarkerSet suffix="" ink="stroke-edge" />
        <MarkerSet suffix="-sel" ink="stroke-accent-ink" />
      </defs>
    </svg>
  );
}
