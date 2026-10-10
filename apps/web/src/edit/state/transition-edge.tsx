import { BaseEdge } from '@xyflow/react';

import type { TransitionFlowEdge } from './state-types.ts';
import type { Point, Rect } from '@nautink/visual-core/geometry';
import type { EdgeProps } from '@xyflow/react';
import type { ReactElement } from 'react';

const DIRECTIONS: Readonly<Record<string, readonly [number, number]>> = {
  top: [0, -1],
  bottom: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const LOOP_REACH: number = 46;
const LOOP_LABEL: number = 18;
const LOOP_STEP: number = 0.6;
const LOOP_INSET: number = 18;
const LOOP_SHARE: number = 0.25;
const MIN_PULL: number = 24;
const PULL_SHARE: number = 0.32;
const PARALLEL_GAP: number = 36;
const HALF: number = 0.5;
/** A cubic Bézier's midpoint weights (t = ½): ⅛, ⅜, ⅜, ⅛. */
const END_WEIGHT: number = 0.125;
const CONTROL_WEIGHT: number = 0.375;
const INTERACTION_WIDTH: number = 16;
const LABEL_PAD_X: number = 4;
const LABEL_PAD_Y: number = 2;
const LABEL_PADDING: [number, number] = [LABEL_PAD_X, LABEL_PAD_Y];

/** An edge's drawn path and where its label sits. */
export interface EdgeGeometry {
  path: string;
  labelX: number;
  labelY: number;
}

/** A loop from a state's right side over its top-right corner; later loops reach further out. */
export function selfLoop(box: Rect, offset: number): EdgeGeometry {
  const reach: number = 1 + offset * LOOP_STEP;
  const startX: number = box.x + box.w;
  const startY: number = box.y + box.h * HALF;
  const endX: number = box.x + box.w - Math.min(LOOP_INSET, box.w * LOOP_SHARE);
  const path: string = `M${String(startX)},${String(startY)} C${String(startX + LOOP_REACH * reach)},${String(startY)} ${String(endX)},${String(box.y - LOOP_REACH * reach)} ${String(endX)},${String(box.y)}`;
  return { path, labelX: startX + LOOP_LABEL * reach, labelY: box.y - LOOP_LABEL * reach };
}

export interface CurveRequest {
  source: { x: number; y: number; side: string };
  target: { x: number; y: number; side: string };
  /** How far this transition sits from the middle of its parallels (0 for a lone one). */
  offset: number;
  /** A→B and B→A share one direction, so their offsets separate them too. */
  isFlipped: boolean;
}

function controls({ source, target, offset, isFlipped }: CurveRequest): [Point, Point] {
  const pull: number = Math.max(
    MIN_PULL,
    Math.hypot(target.x - source.x, target.y - source.y) * PULL_SHARE,
  );
  const [ax, ay] = DIRECTIONS[source.side] ?? [0, 0];
  const [bx, by] = DIRECTIONS[target.side] ?? [0, 0];
  const sign: number = isFlipped ? -1 : 1;
  const dx: number = (target.x - source.x) * sign;
  const dy: number = (target.y - source.y) * sign;
  const length: number = Math.hypot(dx, dy) || 1;
  const nx: number = (-dy / length) * offset * PARALLEL_GAP;
  const ny: number = (dx / length) * offset * PARALLEL_GAP;
  return [
    { x: source.x + ax * pull + nx, y: source.y + ay * pull + ny },
    { x: target.x + bx * pull + nx, y: target.y + by * pull + ny },
  ];
}

/** A cubic curve out of the source side and into the target side, bent away from its parallels. */
export function transitionCurve(request: CurveRequest): EdgeGeometry {
  const { source, target } = request;
  const [{ x: c1x, y: c1y }, { x: c2x, y: c2y }] = controls(request);
  const path: string = `M${String(source.x)},${String(source.y)} C${String(c1x)},${String(c1y)} ${String(c2x)},${String(c2y)} ${String(target.x)},${String(target.y)}`;
  return {
    path,
    labelX: END_WEIGHT * (source.x + target.x) + CONTROL_WEIGHT * (c1x + c2x),
    labelY: END_WEIGHT * (source.y + target.y) + CONTROL_WEIGHT * (c1y + c2y),
  };
}

function edgeGeometry(props: EdgeProps<TransitionFlowEdge>): EdgeGeometry {
  const { data } = props;
  if (data?.isSelf === true && data.box !== null) {
    return selfLoop(data.box, data.offset);
  }
  return transitionCurve({
    source: { x: props.sourceX, y: props.sourceY, side: props.sourcePosition },
    target: { x: props.targetX, y: props.targetY, side: props.targetPosition },
    offset: data?.offset ?? 0,
    isFlipped: data?.isFlipped ?? false,
  });
}

/** A transition (v1's `TransitionEdge`): a curve, a loop for a self-transition, and its label. */
export function TransitionEdge(props: EdgeProps<TransitionFlowEdge>): ReactElement {
  const { path, labelX, labelY } = edgeGeometry(props);
  return (
    <BaseEdge
      id={props.id}
      path={path}
      {...(props.markerEnd === undefined ? {} : { markerEnd: props.markerEnd })}
      label={props.label}
      labelX={labelX}
      labelY={labelY}
      labelShowBg
      labelBgPadding={LABEL_PADDING}
      labelBgBorderRadius={3}
      interactionWidth={INTERACTION_WIDTH}
    />
  );
}
