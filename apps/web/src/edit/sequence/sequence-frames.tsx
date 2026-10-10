// What sits behind the rows: the title, participant boxes, rect backgrounds, lifelines (with their
// destroy crosses) and activation bars.
import { cn } from '@nautink/ui/lib/utils';

import { Label } from './sequence-label.tsx';
import { columnOffset, dragOffset, isSelected } from './sequence-scene.ts';
import { svg, translate } from './svg-path.ts';
import { DARK_CODE_SVG_FILL } from '../canvas/code-colors.ts';

import type { CanvasHandlers, CanvasScene } from './sequence-scene.ts';
import type { Column } from '@nautink/editors/sequence/layout';
import type { ReactElement } from 'react';

const HALF: number = 0.5;
const TITLE_Y: number = 16;
const BOX_RADIUS: number = 6;
const BOX_TITLE_Y: number = 13;
const RECT_RADIUS: number = 3;
const CROSS: number = 8;
const LIFE_HIT: number = 18;
const BAR_W: number = 10;
const BAR_MIN_H: number = 4;

export function DiagramTitle({ scene }: { scene: CanvasScene }): ReactElement | null {
  const { title, titleX } = scene.layout;
  return title === '' ? null : (
    <Label x={titleX} y={TITLE_Y} text={title} className="text-[15px] font-semibold" />
  );
}

function boxFill(fill: string): string {
  return fill === '' || fill === 'transparent' ? 'none' : fill;
}

/** Participant boxes (`box … end`), in the color the code gives them. */
export function BoxFrames({
  scene,
  handlers,
}: {
  scene: CanvasScene;
  handlers: CanvasHandlers;
}): ReactElement {
  return (
    <g>
      {scene.layout.boxes.map(({ box, x1, x2, y1, y2 }) => {
        const isOn: boolean = isSelected(scene, 'box', box.id);
        const isClear: boolean = boxFill(box.fill) === 'none';
        return (
          <g
            key={box.id}
            data-testid={`sequence-box-${box.id}`}
            className="cursor-pointer"
            onPointerDown={(event) => {
              handlers.onBoxDown(event, box.id);
            }}
          >
            <rect
              x={x1}
              y={y1}
              width={x2 - x1}
              height={y2 - y1}
              rx={BOX_RADIUS}
              fill={boxFill(box.fill)}
              fillOpacity={0.22}
              className={cn(
                isOn ? 'stroke-accent-ink [stroke-width:2]' : 'stroke-border',
                isClear && !isOn && 'fill-transparent stroke-faint [stroke-dasharray:4_3]',
              )}
            />
            {box.name === '' ? null : (
              <Label
                x={(x1 + x2) * HALF}
                y={y1 + BOX_TITLE_Y}
                text={box.name}
                className="text-xs font-semibold"
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

/** `rect` blocks paint their color behind everything else (faint in dark mode, `code-colors.ts`). */
export function RectBackgrounds({ scene }: { scene: CanvasScene }): ReactElement {
  return (
    <g className="pointer-events-none">
      {scene.layout.blocks
        .filter((block) => block.item.kind === 'rect')
        .map((block) => (
          <rect
            key={block.item.id}
            x={block.x1}
            y={block.y1 + dragOffset(scene, block.item.id)}
            width={block.x2 - block.x1}
            height={block.y2 - block.y1}
            rx={RECT_RADIUS}
            fill={block.item.sections[0]?.label ?? 'none'}
            className={DARK_CODE_SVG_FILL}
          />
        ))}
    </g>
  );
}

function DestroyCross({ col }: { col: Column }): ReactElement {
  const { x, lifeBottom: y } = col;
  return (
    <path
      className="fill-none stroke-destructive [stroke-width:2]"
      d={svg`M${x - CROSS},${y - CROSS} L${x + CROSS},${y + CROSS} M${x + CROSS},${y - CROSS} L${x - CROSS},${y + CROSS}`}
    />
  );
}

/** Lifelines; dragging from one to another draws a message. */
export function Lifelines({
  scene,
  handlers,
}: {
  scene: CanvasScene;
  handlers: CanvasHandlers;
}): ReactElement {
  return (
    <g>
      {scene.layout.cols.map((col) => (
        <g key={col.id} transform={translate(columnOffset(scene, col.id), 0)}>
          <line
            x1={col.x}
            x2={col.x}
            y1={col.lifeTop}
            y2={col.lifeBottom}
            className="stroke-edge opacity-80 [stroke-dasharray:4_4]"
          />
          {col.isDestroyed ? <DestroyCross col={col} /> : null}
          {scene.isReadOnly ? null : (
            <rect
              data-testid={`sequence-lifeline-${col.id}`}
              x={col.x - LIFE_HIT * HALF}
              y={col.lifeTop}
              width={LIFE_HIT}
              height={Math.max(0, col.lifeBottom - col.lifeTop)}
              className="cursor-crosshair fill-transparent hover:fill-accent-wash"
              onPointerDown={(event) => {
                handlers.onLifeDown(event, col);
              }}
            >
              <title>Drag to another lifeline to add a message</title>
            </rect>
          )}
        </g>
      ))}
    </g>
  );
}

/** Activation bars; one left open runs dashed to the end. */
export function ActivationBars({ scene }: { scene: CanvasScene }): ReactElement {
  return (
    <g className="pointer-events-none">
      {scene.layout.bars.map((bar) => (
        <rect
          key={`${bar.actor}:${String(bar.y1)}:${String(bar.x)}`}
          x={bar.x}
          y={bar.y1}
          width={BAR_W}
          height={Math.max(BAR_MIN_H, bar.y2 - bar.y1)}
          className={cn(
            'fill-accent-wash stroke-node-stroke',
            bar.isOpen && 'opacity-60 [stroke-dasharray:3_3]',
          )}
        />
      ))}
    </g>
  );
}
