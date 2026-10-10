// Things dragged from the toolbar or the library onto the canvas (v1's palette drag and drop).
import { BLOCKS, KINDS } from '@nautink/editors/sequence/constants';
import { nearestCol, nearestSlot } from '@nautink/editors/sequence/layout';

import { slotOf } from './sequence-drag.ts';

import type { Point } from '../../preview/view-math.ts';
import type { Column, ItemPlace, SequenceLayout } from '@nautink/editors/sequence/layout';
import type { Slot } from '@nautink/editors/sequence/tree';
import type { BlockKind, NotePlacement, ParticipantKind } from '@nautink/editors/sequence/types';

/** The drag data type of sequence tools: `participant:<kind>`, `block:<kind>` or `note`. */
export const SEQUENCE_DRAG_TYPE: string = 'application/x-nautink-sequence';

/** Any column is close enough for a dropped note. */
const ANY_DISTANCE: number = Number.POSITIVE_INFINITY;

export type DropOutcome =
  | { kind: 'participant'; participantKind: ParticipantKind; index: number }
  | { kind: 'note'; actor: string; placement: NotePlacement; slot: Slot }
  | { kind: 'block'; blockKind: BlockKind; slot: Slot };

export function participantDragData(kind: ParticipantKind): string {
  return `participant:${kind}`;
}

export function blockDragData(kind: BlockKind): string {
  return `block:${kind}`;
}

export const NOTE_DRAG_DATA: string = 'note';

function isParticipantKind(text: string): text is ParticipantKind {
  return KINDS.some((kind) => kind === text);
}

function isBlockKind(text: string): text is BlockKind {
  return Object.hasOwn(BLOCKS, text);
}

function noteDrop(layout: SequenceLayout, at: Point): DropOutcome | null {
  const col: Column | null = nearestCol(layout, at.x, ANY_DISTANCE);
  const slot: ItemPlace | null = nearestSlot(layout, at.y);
  if (col === null || slot === null) {
    return null;
  }
  return {
    kind: 'note',
    actor: col.id,
    placement: at.x < col.x ? 'left' : 'right',
    slot: slotOf(slot),
  };
}

/** What a drop of `data` at canvas point `at` adds; null for anything else. */
export function dropOutcome(data: string, at: Point, layout: SequenceLayout): DropOutcome | null {
  const [type = '', value = ''] = data.split(':');
  if (type === 'participant' && isParticipantKind(value)) {
    const index: number = layout.cols.filter((col) => col.x < at.x).length;
    return { kind: 'participant', participantKind: value, index };
  }
  if (type === 'block' && isBlockKind(value)) {
    const slot: ItemPlace | null = nearestSlot(layout, at.y);
    return {
      kind: 'block',
      blockKind: value,
      slot: slot === null ? { key: 'root', index: 0 } : slotOf(slot),
    };
  }
  return data === NOTE_DRAG_DATA ? noteDrop(layout, at) : null;
}
