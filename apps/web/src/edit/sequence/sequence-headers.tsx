import { HEAD_H, ICON_KINDS } from '@nautink/editors/sequence/layout';
import { cn } from '@nautink/ui/lib/utils';

import { footerTop, headerLabel, headerTop } from './sequence-geometry.ts';
import { Glyph } from './sequence-glyphs.tsx';
import { Label } from './sequence-label.tsx';
import { columnOffset, isEditing, isSelected } from './sequence-scene.ts';
import { translate } from './svg-path.ts';

import type { CanvasHandlers, CanvasScene } from './sequence-scene.ts';
import type { Column } from '@nautink/editors/sequence/layout';
import type { ReactElement } from 'react';

const HALF: number = 0.5;
const HIT_PAD: number = 4;
const HIT_TOP: number = 2;

/** The accent on a selected glyph: every outline but the click area. */
const SELECTED: string =
  '[&_:is(rect,circle,path,ellipse):not([data-hit])]:stroke-accent-ink [&_:is(rect,circle,path,ellipse):not([data-hit])]:[stroke-width:2]';

interface HeaderProps {
  col: Column;
  top: number;
  isSelected: boolean;
  isLabelHidden: boolean;
  testId: string;
  handlers: CanvasHandlers;
}

/** A participant's header or footer: its glyph and name (v1's `Header`). */
function Header({
  col,
  top,
  isSelected: isOn,
  isLabelHidden,
  testId,
  handlers,
}: HeaderProps): ReactElement {
  const height: number = HEAD_H[col.p.kind];
  const label: { x: number; y: number } = headerLabel(col, top);
  const labelClass: string | undefined = ICON_KINDS.has(col.p.kind) ? undefined : 'font-medium';
  return (
    <g
      data-testid={testId}
      aria-label={col.p.label}
      className={cn('cursor-grab', isOn && SELECTED)}
      onPointerDown={(event) => {
        handlers.onHeadDown(event, col.id);
      }}
      onDoubleClick={() => {
        handlers.onEdit({ kind: 'participant', id: col.id });
      }}
    >
      <rect
        data-hit=""
        className="fill-transparent"
        x={col.x - col.w * HALF - HIT_PAD}
        y={top - HIT_TOP}
        width={col.w + HIT_PAD + HIT_PAD}
        height={height + HIT_PAD}
      />
      <Glyph kind={col.p.kind} box={{ cx: col.x, top, w: col.w }} />
      {isLabelHidden ? null : (
        <Label x={label.x} y={label.y} text={col.p.label} className={labelClass} />
      )}
    </g>
  );
}

/** Every participant's header and footer (a destroyed participant has no footer). */
export function Headers({
  scene,
  handlers,
}: {
  scene: CanvasScene;
  handlers: CanvasHandlers;
}): ReactElement {
  const { layout } = scene;
  return (
    <g>
      {layout.cols.map((col) => {
        const shared: Omit<HeaderProps, 'top' | 'testId'> = {
          col,
          isSelected: isSelected(scene, 'participant', col.id),
          isLabelHidden: isEditing(scene, { kind: 'participant', id: col.id }),
          handlers,
        };
        return (
          <g key={col.id} transform={translate(columnOffset(scene, col.id), 0)}>
            <Header
              {...shared}
              top={headerTop(layout, col)}
              testId={`sequence-participant-${col.id}`}
            />
            {col.isDestroyed ? null : (
              <Header {...shared} top={footerTop(layout)} testId={`sequence-footer-${col.id}`} />
            )}
          </g>
        );
      })}
    </g>
  );
}
