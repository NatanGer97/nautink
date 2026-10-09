import { nodeSize } from '@nautink/editors/flow/size';
import { cn } from '@nautink/ui/lib/utils';

import { drawShape } from './shape-geometry.ts';

import type { DrawnPart, ShapeRole } from './shape-geometry.ts';
import type { Size } from '@nautink/visual-core/geometry';
import type { ReactElement } from 'react';

/** Token colors per part role (PRD §6.1): nodes fill and stroke, details stroke only. */
const ROLE_CLASS: Readonly<Record<ShapeRole, string>> = {
  outline: 'fill-node-fill',
  deco: 'fill-none',
  decoFill: 'fill-node-stroke',
  solid: 'fill-foreground stroke-foreground',
  open: 'fill-none',
  ghost: 'fill-transparent stroke-transparent',
  bare: 'fill-node-fill stroke-none',
};

function Part({ part, className }: { part: DrawnPart; className: string }): ReactElement {
  const isMoved: boolean = part.dx !== 0 || part.dy !== 0;
  return (
    <path
      d={part.d}
      className={className}
      {...(isMoved ? { transform: `translate(${String(part.dx)} ${String(part.dy)})` } : {})}
    />
  );
}

export interface ShapeOutlineProps {
  shape: string;
  width: number;
  height: number;
  isSelected: boolean;
}

/** A node's outline in its box, with the 3 px selection halo (M1) when selected. */
export function ShapeOutline({
  shape,
  width,
  height,
  isSelected,
}: ShapeOutlineProps): ReactElement {
  const parts: DrawnPart[] = drawShape(shape, width, height);
  const halo: DrawnPart[] = isSelected ? parts.filter((part) => part.role === 'outline') : [];
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      className={cn(
        'absolute inset-0 overflow-visible stroke-node-stroke [stroke-width:1.5]',
        isSelected && 'stroke-accent-ink',
      )}
    >
      {halo.map((part, index) => (
        <Part
          key={`halo-${String(index)}`}
          part={part}
          className="fill-none stroke-selection-ring [stroke-width:6]"
        />
      ))}
      {parts.map((part, index) => (
        <Part key={String(index)} part={part} className={ROLE_CLASS[part.role]} />
      ))}
    </svg>
  );
}

/** Size of a shape's picture in pickers: drawn at a normal node size, then scaled down. */
function iconBox(shape: string): Size {
  return nodeSize({ shape, label: 'Label' });
}

const WIDE: number = 1.35;
const TALL: number = 0.85;
/** Room for the 1.5 px stroke on both sides of the picture. */
const STROKE_ROOM: number = 2;

/** A small picture of a shape for the toolbar, the library and the inspector. */
export function ShapeIcon({ shape, size = 26 }: { shape: string; size?: number }): ReactElement {
  const { width, height } = iconBox(shape);
  const scale: number = Math.min((size * WIDE) / width, (size * TALL) / height);
  return (
    <svg
      aria-hidden="true"
      width={Math.round(width * scale)}
      height={Math.round(height * scale)}
      viewBox={`-1 -1 ${String(width + STROKE_ROOM)} ${String(height + STROKE_ROOM)}`}
      className="shrink-0 stroke-muted-foreground [stroke-width:1.5]"
    >
      {drawShape(shape, width, height).map((part, index) => (
        <Part key={String(index)} part={part} className={ROLE_CLASS[part.role]} />
      ))}
    </svg>
  );
}
