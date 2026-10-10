// Messages, notes and the small activation / autonumber chips (v1's `Canvas` rows).
import { LINE_H } from '@nautink/editors/sequence/layout';
import { cn } from '@nautink/ui/lib/utils';

import { arrowStart, messageHitPath, notePath, selfPath } from './sequence-geometry.ts';
import { Label } from './sequence-label.tsx';
import { markerProps } from './sequence-markers.tsx';
import { dragOffset, isEditing, isSelected } from './sequence-scene.ts';
import { translate } from './svg-path.ts';
import { SVG_MARK_CLASSES, useReviewMark } from '../review/review-marks.ts';

import type { CanvasHandlers, CanvasScene } from './sequence-scene.ts';
import type { ReviewMark } from '@nautink/editors/review/review-element';
import type { Row } from '@nautink/editors/sequence/layout';
import type {
  ActivationItem,
  AutonumberItem,
  MessageItem,
  NoteItem,
} from '@nautink/editors/sequence/types';
import type { ReactElement, ReactNode } from 'react';

const HALF: number = 0.5;
const NUMBER_R: number = 8;
const CENTRAL_R: number = 5;
const CENTRAL_TO: number = 16;
const CENTRAL_FROM: number = 10;
const LABEL_UP: number = 9;
const SELF_LABEL_UP: number = 8;
const SELF_LABEL_LEFT: number = 8;
const SELF_NUMBER_LEFT: number = 14;
const CHIP_TOP: number = 3;
const CHIP_H: number = 14;
const CHIP_TEXT_Y: number = 10;
const CHIP_PAD: number = 6;
const CHIP_LEFT: number = 8;
const CHIP_CHAR_W: number = 6.4;
const CHIP_EXTRA: number = 12;
const NO_COLUMN_X: number = 40;
const AUTONUMBER_LEFT: number = 30;

/** A drawn message row: the layout gave it its arrow. */
type ArrowRow = Row & { item: MessageItem; ay: number; x1: number; x2: number };

interface RowProps<Item> {
  row: Row & { item: Item };
  scene: CanvasScene;
  handlers: CanvasHandlers;
}

/** One row's group: selectable, draggable, drawn where a drag has taken it. */
function RowGroup({
  row,
  scene,
  handlers,
  className,
  children,
  onDoubleClick,
}: RowProps<Row['item']> & {
  className: string;
  children: ReactNode;
  onDoubleClick?: () => void;
}): ReactElement {
  const offset: number = dragOffset(scene, row.item.id);
  const mark: ReviewMark | null = useReviewMark(row.item.id);
  return (
    <g
      data-testid={`sequence-item-${row.item.id}`}
      data-review={mark ?? undefined}
      className={cn(
        'group cursor-pointer',
        offset !== 0 && 'opacity-55',
        className,
        mark !== null && SVG_MARK_CLASSES[mark],
      )}
      {...(offset === 0 ? {} : { transform: translate(0, offset) })}
      onPointerDown={(event) => {
        handlers.onItemDown(event, row.item.id);
      }}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </g>
  );
}

function SequenceNumber({ x, y, n }: { x: number; y: number; n: number }): ReactElement {
  return (
    <g>
      <circle cx={x} cy={y} r={NUMBER_R} className="fill-foreground" />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-panel text-[10px] font-semibold"
      >
        {n}
      </text>
    </g>
  );
}

function CentralDots({
  row,
  start,
  isOn,
}: {
  row: ArrowRow;
  start: number;
  isOn: boolean;
}): ReactElement | null {
  const { central } = row.item;
  if (central === '') {
    return null;
  }
  const direction: number = row.x2 >= row.x1 ? 1 : -1;
  const dot: string = cn(
    'fill-panel [stroke-width:1.4]',
    isOn ? 'stroke-accent-ink' : 'stroke-edge',
  );
  return (
    <g>
      {central === 'to' || central === 'both' ? (
        <circle className={dot} cx={row.x2 - direction * CENTRAL_TO} cy={row.ay} r={CENTRAL_R} />
      ) : null}
      {central === 'from' || central === 'both' ? (
        <circle className={dot} cx={start + direction * CENTRAL_FROM} cy={row.ay} r={CENTRAL_R} />
      ) : null}
    </g>
  );
}

function messageLabel(row: ArrowRow): { x: number; y: number; anchor: 'start' | 'middle' } {
  const lift: number = ((row.labelLines ?? 1) - 1) * LINE_H * HALF;
  if (row.isSelf === true) {
    const left: number = row.num === undefined ? SELF_LABEL_LEFT : SELF_NUMBER_LEFT;
    return { x: row.x1 + left, y: row.ay - SELF_LABEL_UP - lift, anchor: 'start' };
  }
  return { x: (row.x1 + row.x2) * HALF, y: row.ay - LABEL_UP - lift, anchor: 'middle' };
}

/** The arrow's start, its path, and its (wider) click area. */
function arrowGeometry(row: ArrowRow): { start: number; path: string; hit: string } {
  if (row.isSelf === true) {
    const path: string = selfPath(row.x1, row.ay);
    return { start: row.x1, path, hit: path };
  }
  const start: number = arrowStart(row);
  const path: string = `M${String(start)},${String(row.ay)} H${String(row.x2)}`;
  return { start, path, hit: messageHitPath(row) };
}

function lineClass(row: ArrowRow, isOn: boolean): string {
  return cn(
    'fill-none [stroke-width:1.5]',
    isOn ? 'stroke-accent-ink [stroke-width:2]' : 'stroke-edge group-hover:stroke-foreground',
    row.item.line === 'dotted' && '[stroke-dasharray:4_3]',
  );
}

function MessageText({ row, isOn }: { row: ArrowRow; isOn: boolean }): ReactElement {
  const label: { x: number; y: number; anchor: 'start' | 'middle' } = messageLabel(row);
  const className: string | undefined = isOn ? 'fill-accent-ink' : undefined;
  return <Label {...label} text={row.item.text} className={className} />;
}

function MessageRow({
  row,
  scene,
  handlers,
}: RowProps<MessageItem> & { row: ArrowRow }): ReactElement {
  const isOn: boolean = isSelected(scene, 'items', row.item.id);
  const { start, path, hit } = arrowGeometry(row);
  const isLabelShown: boolean =
    (row.labelLines ?? 0) > 0 && !isEditing(scene, { kind: 'message', id: row.item.id });
  return (
    <RowGroup
      row={row}
      scene={scene}
      handlers={handlers}
      className=""
      onDoubleClick={() => {
        handlers.onEdit({ kind: 'message', id: row.item.id });
      }}
    >
      <path className="fill-transparent stroke-transparent [stroke-width:12]" d={hit} />
      <path
        className={lineClass(row, isOn)}
        d={path}
        {...markerProps(row.item.head, scene.markerId, isOn)}
      />
      {isLabelShown ? <MessageText row={row} isOn={isOn} /> : null}
      {row.num === undefined ? null : <SequenceNumber x={row.x1} y={row.ay} n={row.num} />}
      <CentralDots row={row} start={start} isOn={isOn} />
    </RowGroup>
  );
}

function NoteRow({ row, scene, handlers }: RowProps<NoteItem>): ReactElement | null {
  const { nx1, nx2, ny, nh } = row;
  if (nx1 === undefined || nx2 === undefined || ny === undefined || nh === undefined) {
    return null;
  }
  const isOn: boolean = isSelected(scene, 'items', row.item.id);
  return (
    <RowGroup
      row={row}
      scene={scene}
      handlers={handlers}
      className=""
      onDoubleClick={() => {
        handlers.onEdit({ kind: 'note', id: row.item.id });
      }}
    >
      <path
        d={notePath({ x1: nx1, x2: nx2, y: ny, h: nh })}
        className={cn(
          'fill-warning-bg',
          isOn ? 'stroke-accent-ink [stroke-width:2]' : 'stroke-warning [stroke-width:1.2]',
        )}
      />
      {isEditing(scene, { kind: 'note', id: row.item.id }) ? null : (
        <Label x={(nx1 + nx2) * HALF} y={ny + nh * HALF} text={row.item.text} />
      )}
    </RowGroup>
  );
}

function Chip({
  x,
  y,
  text,
  isOn,
}: {
  x: number;
  y: number;
  text: string;
  isOn: boolean;
}): ReactElement {
  return (
    <>
      <rect
        x={x}
        y={y + CHIP_TOP}
        width={text.length * CHIP_CHAR_W + CHIP_EXTRA}
        height={CHIP_H}
        rx={CHIP_H * HALF}
        className={cn('fill-muted', isOn ? 'stroke-accent-ink' : 'stroke-border')}
      />
      <text
        x={x + CHIP_PAD}
        y={y + CHIP_TEXT_Y}
        dominantBaseline="central"
        className="fill-muted-foreground text-[10px]"
      >
        {text}
      </text>
    </>
  );
}

function chipOf(
  row: Row & { item: ActivationItem | AutonumberItem },
  scene: CanvasScene,
): { x: number; text: string } {
  const { item } = row;
  if (item.t === 'act') {
    return { x: (row.cx ?? NO_COLUMN_X) + CHIP_LEFT, text: item.isOn ? 'activate' : 'deactivate' };
  }
  const start: string = item.start === undefined ? '' : ` ${String(item.start)}`;
  return {
    x: (scene.layout.cols[0]?.x ?? NO_COLUMN_X) - AUTONUMBER_LEFT,
    text: item.isVisible ? `autonumber${start}` : 'autonumber off',
  };
}

function ChipRow({
  row,
  scene,
  handlers,
}: RowProps<ActivationItem | AutonumberItem>): ReactElement {
  const { x, text } = chipOf(row, scene);
  return (
    <RowGroup row={row} scene={scene} handlers={handlers} className="">
      <Chip x={x} y={row.y} text={text} isOn={isSelected(scene, 'items', row.item.id)} />
    </RowGroup>
  );
}

function isArrowRow(row: Row & { item: MessageItem }): row is ArrowRow {
  return row.ay !== undefined && row.x1 !== undefined && row.x2 !== undefined;
}

function RowView({ row, scene, handlers }: RowProps<Row['item']>): ReactElement | null {
  const { item } = row;
  switch (item.t) {
    case 'msg': {
      const message: Row & { item: MessageItem } = { ...row, item };
      return isArrowRow(message) ? (
        <MessageRow row={message} scene={scene} handlers={handlers} />
      ) : null;
    }
    case 'note':
      return <NoteRow row={{ ...row, item }} scene={scene} handlers={handlers} />;
    case 'act':
    case 'autonumber':
      return <ChipRow row={{ ...row, item }} scene={scene} handlers={handlers} />;
    default:
      return null;
  }
}

/** Every message, note and chip row. */
export function Rows({
  scene,
  handlers,
}: {
  scene: CanvasScene;
  handlers: CanvasHandlers;
}): ReactElement {
  return (
    <g>
      {scene.layout.rows.map((row) => (
        <RowView key={row.item.id} row={row} scene={scene} handlers={handlers} />
      ))}
    </g>
  );
}
