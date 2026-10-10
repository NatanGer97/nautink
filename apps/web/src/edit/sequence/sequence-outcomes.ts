// Turns a finished drag or a drop into edits and a selection.
import { addMessageAt, addParticipant, dropBlock, dropNote } from './sequence-add.ts';
import { moveParticipant, moveRows } from './sequence-moves.ts';
import { itemSelection, NO_SELECTION, participantSelection } from './sequence-types.ts';

import type { SequenceActionContext } from './sequence-actions.ts';
import type { DragOutcome } from './sequence-drag.ts';
import type { DropOutcome } from './sequence-drop.ts';

function applyEdit(
  context: SequenceActionContext,
  outcome: Extract<DragOutcome, { kind: 'moveParticipant' | 'addMessage' | 'moveRows' }>,
): void {
  if (outcome.kind === 'moveParticipant') {
    moveParticipant(context, outcome.id, outcome.to);
    context.select(participantSelection(outcome.id));
  } else if (outcome.kind === 'moveRows') {
    moveRows(context, outcome.ids, outcome.slot);
    context.select(itemSelection(outcome.ids));
  } else {
    addMessageAt(context, outcome);
  }
}

/** Does what a finished press asks for. */
export function applyDragOutcome(context: SequenceActionContext, outcome: DragOutcome): void {
  if (outcome.kind === 'clear') {
    context.select(NO_SELECTION);
    context.edit(null);
  } else if (outcome.kind === 'select') {
    context.select(outcome.selection);
  } else if (outcome.kind !== 'none') {
    applyEdit(context, outcome);
  }
}

/** Adds what was dropped from the toolbar or the library. */
export function applyDropOutcome(context: SequenceActionContext, outcome: DropOutcome): void {
  switch (outcome.kind) {
    case 'participant':
      addParticipant(context, outcome.participantKind, outcome.index);
      return;
    case 'note':
      dropNote(context, outcome);
      return;
    default:
      dropBlock(context, outcome.blockKind, outcome.slot);
  }
}
