import { readable } from '@nautink/editors/class/text';
import { cn } from '@nautink/ui/lib/utils';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getStraightPath,
  Position,
} from '@xyflow/react';
import { memo } from 'react';

import { markerUrl } from './class-markers.tsx';

import type { NoteLinkEdge, UmlEdgeData, UmlFlowEdge } from './class-types.ts';
import type { EdgeProps } from '@xyflow/react';
import type { CSSProperties, NamedExoticComponent, ReactElement } from 'react';

const SELF_LOOP: number = 34;
const MAX_TURN: number = 22;
const MIN_TURN: number = 4;
const HALF: number = 0.5;
const TURN_MARGIN: number = 2;
const INTERACTION_WIDTH: number = 16;
const CORNER_RADIUS: number = 6;

type Point = [number, number];

/** Moves an end along its side by `offset` (fanned-out links). */
function shifted(point: Point, side: Position, offset: number): Point {
  if (offset === 0) {
    return point;
  }
  const isVertical: boolean = side === Position.Left || side === Position.Right;
  return isVertical ? [point[0], point[1] + offset] : [point[0] + offset, point[1]];
}

/** A smaller turn when boxes are close, so the path does not loop back on itself (v1). */
function turnOffset(source: Point, target: Point, side: Position): number {
  const gaps: Readonly<Record<Position, number>> = {
    [Position.Bottom]: target[1] - source[1],
    [Position.Top]: source[1] - target[1],
    [Position.Right]: target[0] - source[0],
    [Position.Left]: source[0] - target[0],
  };
  const gap: number = gaps[side];
  return gap > 0 ? Math.min(MAX_TURN, Math.max(MIN_TURN, gap * HALF - TURN_MARGIN)) : MAX_TURN;
}

/** A self relation leaves the right side and comes back into the top. */
function selfLoop(source: Point, target: Point): [string, number, number] {
  const [sx, sy] = source;
  const [tx, ty] = target;
  const path: string = `M${String(sx)},${String(sy)} H${String(sx + SELF_LOOP)} V${String(ty - SELF_LOOP)} H${String(tx)} V${String(ty)}`;
  return [path, sx + SELF_LOOP, ty - SELF_LOOP];
}

/** Where a multiplicity sits, next to its end and away from the side it leaves. */
function multiplicityStyle(point: Point, side: Position): CSSProperties {
  const nudges: Readonly<Record<Position, string>> = {
    [Position.Right]: 'translate(6px, calc(-100% - 5px))',
    [Position.Left]: 'translate(calc(-100% - 6px), calc(-100% - 5px))',
    [Position.Top]: 'translate(7px, calc(-100% - 6px))',
    [Position.Bottom]: 'translate(7px, 6px)',
  };
  return { transform: `translate(${String(point[0])}px, ${String(point[1])}px) ${nudges[side]}` };
}

function edgePath(
  props: EdgeProps<UmlFlowEdge>,
  source: Point,
  target: Point,
): [string, number, number] {
  if (props.data?.isSelf === true) {
    return selfLoop(source, target);
  }
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: source[0],
    sourceY: source[1],
    targetX: target[0],
    targetY: target[1],
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    borderRadius: CORNER_RADIUS,
    offset: turnOffset(source, target, props.sourcePosition),
  });
  return [path, labelX, labelY];
}

// Relations sit above class boxes (zIndex 2), so their texts sit above the relations.
const TEXT: string = 'pointer-events-none absolute z-3 text-2xs whitespace-nowrap';

interface EdgeTextProps {
  data: UmlEdgeData;
  isSelected: boolean;
  label: Point;
  ends: [Point, Point];
  sides: [Position, Position];
}

/** The relation's label at its middle, and each end's multiplicity next to it. */
function EdgeTexts({ data, isSelected, label, ends, sides }: EdgeTextProps): ReactElement {
  const center: string = `translate(-50%, -50%) translate(${String(label[0])}px, ${String(label[1])}px)`;
  return (
    <EdgeLabelRenderer>
      {data.label === '' ? null : (
        <div
          className={cn(
            TEXT,
            'rounded-xs bg-background px-1 text-muted-foreground',
            isSelected && 'text-accent-ink',
          )}
          style={{ transform: center }}
        >
          {readable(data.label)}
        </div>
      )}
      {data.m1 === '' ? null : (
        <div className={cn(TEXT, 'text-faint')} style={multiplicityStyle(ends[0], sides[0])}>
          {readable(data.m1)}
        </div>
      )}
      {data.m2 === '' ? null : (
        <div className={cn(TEXT, 'text-faint')} style={multiplicityStyle(ends[1], sides[1])}>
          {readable(data.m2)}
        </div>
      )}
    </EdgeLabelRenderer>
  );
}

function UmlEdgeView(props: EdgeProps<UmlFlowEdge>): ReactElement | null {
  const { id, data, selected: isSelected = false } = props;
  if (data === undefined) {
    return null;
  }
  const sides: [Position, Position] = [props.sourcePosition, props.targetPosition];
  const source: Point = shifted([props.sourceX, props.sourceY], sides[0], data.sourceOffset);
  const target: Point = shifted([props.targetX, props.targetY], sides[1], data.targetOffset);
  const [path, labelX, labelY] = edgePath(props, source, target);
  const markerStart: string | undefined = markerUrl(data.t1, isSelected);
  const markerEnd: string | undefined = markerUrl(data.t2, isSelected);
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={data.line === 'dashed' ? '[stroke-dasharray:6_4]' : undefined}
        interactionWidth={INTERACTION_WIDTH}
        {...(markerStart === undefined ? {} : { markerStart })}
        {...(markerEnd === undefined ? {} : { markerEnd })}
      />
      <EdgeTexts
        data={data}
        isSelected={isSelected}
        label={[labelX, labelY]}
        ends={[source, target]}
        sides={sides}
      />
    </>
  );
}

/** A relation: its line style, UML end markers, label and multiplicities (v1's UmlEdge). */
export const UmlEdge: NamedExoticComponent<EdgeProps<UmlFlowEdge>> = memo(UmlEdgeView);

function NoteLinkView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps<NoteLinkEdge>): ReactElement {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  return <BaseEdge id={id} path={path} className="stroke-warning [stroke-dasharray:4_4]" />;
}

/** A note's dashed line to its class. */
export const NoteLink: NamedExoticComponent<EdgeProps<NoteLinkEdge>> = memo(NoteLinkView);
