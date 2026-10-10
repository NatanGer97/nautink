// Arrowheads for messages, as SVG markers in the edge color and (for selected messages) the accent,
// mirroring Mermaid's renderer (v1's `Markers` and `markerFor`).
import type { HeadKind } from '@nautink/editors/sequence/types';
import type { ReactElement } from 'react';

type MarkerName =
  'arrow' | 'async' | 'cross' | 'halfTop' | 'halfBottom' | 'stickTop' | 'stickBottom';

interface MarkerSpec {
  name: MarkerName;
  path: string;
  refX: string;
  refY: string;
  isLine?: boolean;
  /** Cross heads do not flip at the start of a line. */
  orient?: string;
}

const MARKERS: readonly MarkerSpec[] = [
  { name: 'arrow', path: 'M0,0.5 L10,5 L0,9.5 Z', refX: '9.5', refY: '5' },
  { name: 'async', path: 'M0,0.5 L10,5 L0,9.5 L3.2,5 Z', refX: '9.5', refY: '5' },
  {
    name: 'cross',
    path: 'M1.5,1.5 L8.5,8.5 M8.5,1.5 L1.5,8.5',
    refX: '7',
    refY: '5',
    isLine: true,
    orient: 'auto',
  },
  { name: 'halfTop', path: 'M0,2 L10,9 L0,9 Z', refX: '9.5', refY: '9' },
  { name: 'halfBottom', path: 'M0,8 L10,1 L0,1 Z', refX: '9.5', refY: '1' },
  { name: 'stickTop', path: 'M1,2 L9.5,9', refX: '9.5', refY: '9', isLine: true },
  { name: 'stickBottom', path: 'M1,8 L9.5,1', refX: '9.5', refY: '1', isLine: true },
];

function markerClass(spec: MarkerSpec, isSelected: boolean): string {
  if (spec.isLine === true) {
    return isSelected
      ? 'fill-none stroke-accent-ink [stroke-width:1.8] [stroke-linecap:round]'
      : 'fill-none stroke-edge [stroke-width:1.6] [stroke-linecap:round]';
  }
  return isSelected ? 'fill-accent-ink' : 'fill-edge';
}

function markerId(prefix: string, name: MarkerName, isSelected: boolean): string {
  return `${prefix}-${name}${isSelected ? '-selected' : ''}`;
}

/** The marker definitions; `prefix` keeps ids unique when two canvases are on the page. */
export function SequenceMarkers({ prefix }: { prefix: string }): ReactElement {
  return (
    <defs>
      {[false, true].flatMap((isSelected) =>
        MARKERS.map((spec) => (
          <marker
            key={markerId(prefix, spec.name, isSelected)}
            id={markerId(prefix, spec.name, isSelected)}
            viewBox="0 0 10 10"
            refX={spec.refX}
            refY={spec.refY}
            markerWidth="11"
            markerHeight="11"
            markerUnits="userSpaceOnUse"
            orient={spec.orient ?? 'auto-start-reverse'}
          >
            <path d={spec.path} className={markerClass(spec, isSelected)} />
          </marker>
        )),
      )}
    </defs>
  );
}

/** Which end gets which marker, per head (reversed heads sit at the start of the line). */
const HEAD_MARKERS: Readonly<Record<HeadKind, { start?: MarkerName; end?: MarkerName }>> = {
  arrow: { end: 'arrow' },
  open: {},
  cross: { end: 'cross' },
  async: { end: 'async' },
  bi: { start: 'arrow', end: 'arrow' },
  halfTop: { end: 'halfTop' },
  halfBottom: { end: 'halfBottom' },
  stickTop: { end: 'stickTop' },
  stickBottom: { end: 'stickBottom' },
  halfTopRev: { start: 'halfBottom' },
  halfBottomRev: { start: 'halfTop' },
  stickTopRev: { start: 'stickBottom' },
  stickBottomRev: { start: 'stickTop' },
};

/** The `marker-start` / `marker-end` attributes for a message's head. */
export function markerProps(
  head: HeadKind,
  prefix: string,
  isSelected: boolean,
): { markerStart?: string; markerEnd?: string } {
  const { start, end } = HEAD_MARKERS[head];
  const url = (name: MarkerName): string => `url(#${markerId(prefix, name, isSelected)})`;
  return {
    ...(start === undefined ? {} : { markerStart: url(start) }),
    ...(end === undefined ? {} : { markerEnd: url(end) }),
  };
}

/** The accent arrowhead for drag previews. */
export function previewMarker(prefix: string): string {
  return `url(#${markerId(prefix, 'arrow', true)})`;
}
