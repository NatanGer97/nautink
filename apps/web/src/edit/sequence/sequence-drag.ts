// Pointer gestures on the sequence canvas (v1's `startDrag`, `onMove`, `onUp`), pure: what a drag
// shows while it moves and what it does when it ends. Order decides the layout, so a drag never
// stores a position: it picks a column index or a slot between rows.
import { nearestCol, nearestSlot } from '@nautink/editors/sequence/layout';
import { isDescendantKey } from '@nautink/editors/sequence/tree';

import { clickedRow } from './sequence-selection.ts';
import { itemSelection, participantSelection, toggledParticipant } from './sequence-types.ts';

import type { SequenceSelection } from './sequence-types.ts';
import type { Point, ViewTransform } from '../../preview/view-math.ts';
import type { Column, ItemPlace, SequenceLayout } from '@nautink/editors/sequence/layout';
import type { Slot } from '@nautink/editors/sequence/tree';
import type { SequenceModel } from '@nautink/editors/sequence/types';

/** A press that moves less than this (screen pixels) is a click. */
const DRAG_THRESHOLD_PX: number = 5;
/** How far from a lifeline a link drag still finds it. */
const LINK_REACH: number = 70;
/** A self message drawn back onto its own start is no message. */
const SELF_SLACK: number = 8;

/** What a press started on. */
export type DragStart =
  | { mode: 'pan'; view: ViewTransform }
  | { mode: 'col'; id: string; isShift?: boolean }
  | { mode: 'link'; from: string; x: number }
  | { mode: 'item'; id: string; ids: readonly string[]; isShift: boolean };

export interface DragSession {
  start: DragStart;
  /** Where the press started, in canvas coordinates. */
  origin: Point;
  /** Where the press started on screen. */
  client: Point;
  isMoved: boolean;
}

/** What the canvas draws while a drag moves. */
export type DragPreview =
  | { mode: 'col'; id: string; dx: number; x: number }
  | { mode: 'link'; from: string; x0: number; y0: number; x: number; target: string | null }
  | { mode: 'item'; ids: readonly string[]; slot: ItemPlace | null; dy: number };

/** What a finished press does. */
export type DragOutcome =
  | { kind: 'none' }
  | { kind: 'clear' }
  | { kind: 'select'; selection: SequenceSelection }
  | { kind: 'moveParticipant'; id: string; to: number }
  | { kind: 'addMessage'; from: string; to: string; slot: Slot }
  | { kind: 'moveRows'; ids: readonly string[]; slot: Slot };

export interface DragScene {
  layout: SequenceLayout;
  model: SequenceModel;
  selection: SequenceSelection;
  isReadOnly: boolean;
}

/** True once the pointer has travelled far enough from where it was pressed. */
export function isPastThreshold(session: DragSession, client: Point): boolean {
  return (
    session.isMoved ||
    Math.hypot(client.x - session.client.x, client.y - session.client.y) >= DRAG_THRESHOLD_PX
  );
}

/** Slots inside the moving rows (a block into itself) are not drop targets. */
export function insideMoving(
  model: SequenceModel,
  ids: readonly string[],
): (slot: ItemPlace) => boolean {
  return (slot: ItemPlace): boolean =>
    slot.key !== 'root' &&
    ids.some((id) => slot.key.startsWith(`${id}:`) || isDescendantKey(model, id, slot.key));
}

/** Just the list and index of a layout slot: what the ops take. */
export function slotOf(place: ItemPlace): Slot {
  return { key: place.key, index: place.index };
}

function slotAt(scene: DragScene, ids: readonly string[], y: number): ItemPlace | null {
  return nearestSlot(scene.layout, y, insideMoving(scene.model, ids));
}

/** A session whose press started on one kind of thing. */
type SessionOf<Mode extends DragStart['mode']> = Omit<DragSession, 'start'> & {
  start: Extract<DragStart, { mode: Mode }>;
};

function linkPreview(session: SessionOf<'link'>, at: Point, scene: DragScene): DragPreview {
  const target: Column | null = nearestCol(scene.layout, at.x, LINK_REACH);
  const { from, x } = session.start;
  return { mode: 'link', from, x0: x, y0: session.origin.y, x: at.x, target: target?.id ?? null };
}

function rowPreview(session: SessionOf<'item'>, at: Point, scene: DragScene): DragPreview {
  const { ids } = session.start;
  return { mode: 'item', ids, slot: slotAt(scene, ids, at.y), dy: at.y - session.origin.y };
}

/** The drag's preview at canvas point `at`; null for a pan. */
export function dragPreview(session: DragSession, at: Point, scene: DragScene): DragPreview | null {
  const { start } = session;
  switch (start.mode) {
    case 'col':
      return { mode: 'col', id: start.id, dx: at.x - session.origin.x, x: at.x };
    case 'link':
      return linkPreview({ ...session, start }, at, scene);
    case 'item':
      return rowPreview({ ...session, start }, at, scene);
    default:
      return null;
  }
}

function columnOutcome(id: string, at: Point, scene: DragScene): DragOutcome {
  const from: number = scene.model.participants.findIndex((participant) => participant.id === id);
  const left: number = scene.layout.cols.filter((col) => col.id !== id && col.x < at.x).length;
  if (scene.isReadOnly || left === from) {
    return { kind: 'select', selection: participantSelection(id) };
  }
  return { kind: 'moveParticipant', id, to: left >= from ? left + 1 : left };
}

function linkOutcome(session: SessionOf<'link'>, at: Point, scene: DragScene): DragOutcome {
  const { from, x } = session.start;
  if (!session.isMoved) {
    return { kind: 'select', selection: participantSelection(from) };
  }
  const target: Column | null = nearestCol(scene.layout, at.x, LINK_REACH);
  const isBackOnStart: boolean =
    target?.id === from &&
    Math.abs(at.y - session.origin.y) < SELF_SLACK &&
    Math.abs(at.x - x) < SELF_SLACK;
  const slot: ItemPlace | null = nearestSlot(scene.layout, session.origin.y);
  if (scene.isReadOnly || target === null || isBackOnStart || slot === null) {
    return { kind: 'none' };
  }
  return { kind: 'addMessage', from, to: target.id, slot: slotOf(slot) };
}

function rowOutcome(session: SessionOf<'item'>, at: Point, scene: DragScene): DragOutcome {
  const { id, ids, isShift } = session.start;
  if (!session.isMoved) {
    return { kind: 'select', selection: clickedRow(scene.model, scene.selection, { id, isShift }) };
  }
  const slot: ItemPlace | null = slotAt(scene, ids, at.y);
  if (scene.isReadOnly || slot === null) {
    return { kind: 'select', selection: itemSelection(ids) };
  }
  return { kind: 'moveRows', ids, slot: slotOf(slot) };
}

function clickedHeader(
  start: Extract<DragStart, { mode: 'col' }>,
  selection: SequenceSelection,
): SequenceSelection {
  return start.isShift === true
    ? toggledParticipant(selection, start.id)
    : participantSelection(start.id);
}

/** What the press does when it ends at canvas point `at`. */
export function dragOutcome(session: DragSession, at: Point, scene: DragScene): DragOutcome {
  const { start } = session;
  switch (start.mode) {
    case 'col':
      return session.isMoved
        ? columnOutcome(start.id, at, scene)
        : { kind: 'select', selection: clickedHeader(start, scene.selection) };
    case 'link':
      return linkOutcome({ ...session, start }, at, scene);
    case 'item':
      return rowOutcome({ ...session, start }, at, scene);
    default:
      return session.isMoved ? { kind: 'none' } : { kind: 'clear' };
  }
}
