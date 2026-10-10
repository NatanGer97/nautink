import { cn } from '@nautink/ui/lib/utils';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position } from '@xyflow/react';
import { memo } from 'react';

import { useErEditorContext } from './er-context.ts';
import { InlineInput } from './er-inline-input.tsx';

import type { ErCanvasEdge } from './er-types.ts';
import type { Point } from '@nautink/visual-core/geometry';
import type { EdgeProps } from '@xyflow/react';
import type { NamedExoticComponent, ReactElement } from 'react';

const LOOP_REACH: number = 34;
const CORNER: number = 8;
const STEP_OFFSET: number = 30;
const INTERACTION_WIDTH: number = 16;
const HALF: number = 0.5;

/** A path and where its label sits. */
type RoutedPath = [path: string, labelX: number, labelY: number];

/** Slides an end along its side, so several links on one side do not overlap (v1). */
export function shiftEnd(point: Point, side: Position, distance: number): Point {
  if (distance === 0) {
    return point;
  }
  const isAcross: boolean = side === Position.Left || side === Position.Right;
  return isAcross ? { x: point.x, y: point.y + distance } : { x: point.x + distance, y: point.y };
}

function roundedCorner(previous: Point, corner: Point, next: Point): string {
  const before: Point = {
    x: corner.x - Math.sign(corner.x - previous.x) * CORNER,
    y: corner.y - Math.sign(corner.y - previous.y) * CORNER,
  };
  const after: Point = {
    x: corner.x + Math.sign(next.x - corner.x) * CORNER,
    y: corner.y + Math.sign(next.y - corner.y) * CORNER,
  };
  return ` L${String(before.x)},${String(before.y)} Q${String(corner.x)},${String(corner.y)} ${String(after.x)},${String(after.y)}`;
}

/** An entity related to itself: out of the right side, round the top-right corner, into the top. */
export function selfLoop(source: Point, target: Point): RoutedPath {
  const out: Point = { x: source.x + LOOP_REACH, y: source.y };
  const over: Point = { x: source.x + LOOP_REACH, y: target.y - LOOP_REACH };
  const down: Point = { x: target.x, y: target.y - LOOP_REACH };
  const corners: string =
    roundedCorner(source, out, over) +
    roundedCorner(out, over, down) +
    roundedCorner(over, down, target);
  const path: string = `M${String(source.x)},${String(source.y)}${corners} L${String(target.x)},${String(target.y)}`;
  return [path, (source.x + LOOP_REACH + target.x) * HALF, target.y - LOOP_REACH];
}

function routedPath(props: EdgeProps<ErCanvasEdge>): RoutedPath {
  const { data, sourcePosition, targetPosition } = props;
  const source: Point = shiftEnd(
    { x: props.sourceX, y: props.sourceY },
    sourcePosition,
    data?.sourceShift ?? 0,
  );
  const target: Point = shiftEnd(
    { x: props.targetX, y: props.targetY },
    targetPosition,
    data?.targetShift ?? 0,
  );
  if (data?.isSelf === true) {
    return selfLoop(source, target);
  }
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: source.x,
    sourceY: source.y,
    sourcePosition,
    targetX: target.x,
    targetY: target.y,
    targetPosition,
    borderRadius: CORNER,
    offset: STEP_OFFSET,
  });
  return [path, labelX, labelY];
}

function EdgeLabel({
  id,
  label,
  isSelected,
}: {
  id: string;
  label: string;
  isSelected: boolean;
}): ReactElement {
  const { editingId, setEditingId, setRelLabel, selectRel, isReadOnly } = useErEditorContext();
  if (editingId === id && !isReadOnly) {
    return (
      <InlineInput
        label="Relationship label"
        value={label}
        className="bg-transparent text-center text-[11px]"
        onDone={(text) => {
          setEditingId(null);
          if (text !== null) {
            setRelLabel(id, text);
          }
        }}
      />
    );
  }
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`Relationship ${label}`}
      className={cn('cursor-pointer', isSelected && 'text-accent-ink')}
      onClick={() => {
        selectRel(id);
      }}
      onDoubleClick={(event) => {
        if (!isReadOnly) {
          event.stopPropagation();
          setEditingId(id);
        }
      }}
    >
      {label === '' ? ' ' : label}
    </button>
  );
}

function ErEdgeView(props: EdgeProps<ErCanvasEdge>): ReactElement {
  const { id, data, selected: isSelected = false, markerStart, markerEnd } = props;
  const [path, labelX, labelY] = routedPath(props);
  const label: string = data?.label ?? '';
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        {...(markerStart === undefined ? {} : { markerStart })}
        {...(markerEnd === undefined ? {} : { markerEnd })}
        interactionWidth={INTERACTION_WIDTH}
        className={data?.isIdentifying === false ? '[stroke-dasharray:6_4]' : ''}
      />
      <EdgeLabelRenderer>
        <div
          data-testid={`er-label-${id}`}
          className={cn(
            'nodrag nopan pointer-events-auto absolute z-[2] rounded-full border bg-background px-2 text-[11px] leading-4 whitespace-nowrap text-muted-foreground',
            isSelected ? 'border-accent-ink' : 'border-border',
            label === '' && 'min-w-[18px] border-dashed',
          )}
          style={{
            transform: `translate(-50%, -50%) translate(${String(labelX)}px, ${String(labelY)}px)`,
          }}
        >
          <EdgeLabel id={id} label={label} isSelected={isSelected} />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

/** A relationship: a stepped line with crow's-foot ends, dashed when non-identifying, and its label. */
export const ErEdge: NamedExoticComponent<EdgeProps<ErCanvasEdge>> = memo(ErEdgeView);
