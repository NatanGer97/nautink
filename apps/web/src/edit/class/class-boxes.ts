// The box of every class canvas item and namespace frame (v1's `boxes` memo), from the model, the
// positions and the measured sizes.
import { allNamespaces, canvasItems } from '@nautink/editors/class/layout';
import { nsParent } from '@nautink/editors/class/text';

import { FRAME_PREFIX } from './class-types.ts';
import { canvasTextMeasurer } from '../canvas/text-measurer.ts';

import type { CanvasItem } from '@nautink/editors/class/layout';
import type { ClassModel } from '@nautink/editors/class/types';
import type { Rect } from '@nautink/visual-core/geometry';
import type { Position, PositionMap } from '@nautink/visual-core/positions';

const FRAME_PAD: number = 20;
const FRAME_TITLE: number = 22;
const ORIGIN: Position = { x: 0, y: 0 };

/** Where an item sits, or the origin before it has a spot. */
export function positionOf(positions: PositionMap, id: string): Position {
  return (Object.hasOwn(positions, id) ? positions[id] : undefined) ?? ORIGIN;
}

/** The namespace ids, deepest first, so outer frames wrap inner ones. */
function deepestFirst(model: ClassModel): string[] {
  return allNamespaces(model).sort((a, b) => b.split('.').length - a.split('.').length);
}

function innerBoxes(model: ClassModel, id: string, boxes: ReadonlyMap<string, Rect>): Rect[] {
  const ids: string[] = [
    ...model.classes.filter((item) => item.ns === id).map((item) => item.id),
    ...model.notes.filter((note) => note.ns === id).map((note) => note.id),
    ...allNamespaces(model)
      .filter((ns) => nsParent(ns) === id)
      .map((ns) => FRAME_PREFIX + ns),
  ];
  return ids.flatMap((inner) => {
    const box: Rect | undefined = boxes.get(inner);
    return box === undefined ? [] : [box];
  });
}

function frameAround(inner: readonly Rect[]): Rect {
  const x: number = Math.min(...inner.map((box) => box.x)) - FRAME_PAD;
  const y: number = Math.min(...inner.map((box) => box.y)) - FRAME_PAD - FRAME_TITLE;
  const right: number = Math.max(...inner.map((box) => box.x + box.w)) + FRAME_PAD;
  const bottom: number = Math.max(...inner.map((box) => box.y + box.h)) + FRAME_PAD;
  return { x, y, w: right - x, h: bottom - y };
}

/** Item boxes by item id, and namespace frames by `ns:<id>` (frames with no content have none). */
export function classBoxes(model: ClassModel, positions: PositionMap): Map<string, Rect> {
  const boxes: Map<string, Rect> = new Map<string, Rect>();
  for (const item of canvasItems(model, canvasTextMeasurer)) {
    const { x, y } = positionOf(positions, item.id);
    boxes.set(item.id, { x, y, w: item.size.width, h: item.size.height });
  }
  for (const id of deepestFirst(model)) {
    const inner: Rect[] = innerBoxes(model, id, boxes);
    if (inner.length > 0) {
      boxes.set(FRAME_PREFIX + id, frameAround(inner));
    }
  }
  return boxes;
}

/** Whether a namespace id is `ns` or nested inside it. */
export function isInside(id: string, ns: string): boolean {
  return id === ns || id.startsWith(`${ns}.`);
}

/** The canvas items inside a namespace (nested ones included): what dragging its frame moves. */
export function framedIds(model: ClassModel, ns: string): string[] {
  return canvasItems(model, canvasTextMeasurer)
    .filter((item: CanvasItem) => item.kind !== 'lolli' && isInside(item.ns, ns))
    .map((item: CanvasItem) => item.id);
}
