import { LINE_H, linesOf } from '@nautink/editors/sequence/layout';
import { cn } from '@nautink/ui/lib/utils';

import type { ReactElement } from 'react';

const HALF: number = 0.5;

export interface LabelProps {
  x: number;
  /** The middle of the text block. */
  y: number;
  text: string;
  anchor?: 'start' | 'middle';
  className?: string | undefined;
}

/** Text on the canvas, one line per `<br>`, centred on `y` (v1's `Label`). */
export function Label({ x, y, text, anchor = 'middle', className }: LabelProps): ReactElement {
  const lines: string[] = linesOf(text);
  const top: number = y - (lines.length - 1) * LINE_H * HALF;
  return (
    <text
      className={cn('fill-foreground', className)}
      x={x}
      y={top}
      textAnchor={anchor}
      dominantBaseline="central"
    >
      {lines.map((line, index) => (
        // Lines have no identity of their own: their order is the text.
        <tspan key={String(index)} x={x} y={top + index * LINE_H}>
          {line === '' ? ' ' : line}
        </tspan>
      ))}
    </text>
  );
}
