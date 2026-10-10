// Deleting and moving: the selection, rows dragged to a slot or stepped with the arrow keys, and
// participant columns dragged sideways or stepped with ← →.
import * as ops from '@nautink/editors/sequence/ops';
import * as people from '@nautink/editors/sequence/participants';
import { stepItems } from '@nautink/editors/sequence/steps';
import { deleteLabel } from '@nautink/visual-core/labels';

import { apply } from './sequence-actions.ts';
import { boxName, itemName, participantName, rowsLabel } from './sequence-names.ts';
import { NO_SELECTION } from './sequence-types.ts';

import type { SequenceActionContext } from './sequence-actions.ts';
import type { SequenceSelection } from './sequence-types.ts';
import type { StepDirection } from '@nautink/editors/sequence/steps';
import type { Slot } from '@nautink/editors/sequence/tree';
import type { SequenceModel } from '@nautink/editors/sequence/types';

function deleted(model: SequenceModel, selection: SequenceSelection): SequenceModel {
  switch (selection.kind) {
    case 'items':
      return ops.deleteItems(model, selection.ids);
    case 'participant':
      return selection.ids.reduce(people.deleteParticipant, model);
    case 'box':
      return selection.ids.reduce(people.removeBox, model);
    default:
      return model;
  }
}

function deletedNames(model: SequenceModel, selection: SequenceSelection): string[] {
  if (selection.kind === 'box') {
    return selection.ids.map((id) => `box ${boxName(model, id)}`);
  }
  return selection.ids.map((id) =>
    selection.kind === 'participant' ? participantName(model, id) : itemName(model, id),
  );
}

/** Deletes the selection: rows, participants with every row on them, or a box (keeping members). */
export function deleteSelection(context: SequenceActionContext): void {
  const selection: SequenceSelection = context.getSelection();
  if (selection.kind === null) {
    return;
  }
  apply(
    context,
    (model) => deleted(model, selection),
    (model) => deleteLabel(deletedNames(model, selection)),
  );
  context.select(NO_SELECTION);
}

function movedLabel(model: SequenceModel, ids: readonly string[]): string {
  const [only] = ids;
  return ids.length === 1 && only !== undefined
    ? `Moved ${itemName(model, only)}`
    : `Moved ${rowsLabel(ids.length)}`;
}

/** Moves rows to a slot (a drag that ended between rows). */
export function moveRows(context: SequenceActionContext, ids: readonly string[], slot: Slot): void {
  apply(
    context,
    (model) => ops.moveItems(model, ids, slot),
    (model) => movedLabel(model, ids),
  );
}

/** Moves rows one step up or down (the arrow keys). */
export function stepRows(
  context: SequenceActionContext,
  ids: readonly string[],
  direction: StepDirection,
): void {
  apply(
    context,
    (model) => stepItems(model, ids, direction),
    (model) => movedLabel(model, ids),
  );
}

/** Moves a participant column to index `to` (counted before it leaves its place, as v1). */
export function moveParticipant(context: SequenceActionContext, id: string, to: number): void {
  apply(
    context,
    (model) => people.moveParticipant(model, id, to),
    (model) => `Moved ${participantName(model, id)}`,
  );
}

/** Moves a participant one column left or right; nothing at either end. */
export function stepParticipant(
  context: SequenceActionContext,
  id: string,
  direction: StepDirection,
): void {
  const participants: SequenceModel['participants'] = context.getModel()?.participants ?? [];
  const from: number = participants.findIndex((participant) => participant.id === id);
  const target: number = from + direction;
  const neighbour: SequenceModel['participants'][number] | undefined =
    from < 0 ? undefined : participants[target];
  if (neighbour !== undefined && !neighbour.isCreated) {
    moveParticipant(context, id, direction > 0 ? target + 1 : target);
  }
}
