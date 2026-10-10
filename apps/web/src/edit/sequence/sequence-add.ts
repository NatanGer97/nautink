// Adding things (v1's palette, lifeline drags and drops): participants, messages, notes and blocks.
// Each new thing is selected, and messages, notes and participants open for typing at once.
import { KIND_NAMES } from '@nautink/editors/sequence/constants';
import { findItem } from '@nautink/editors/sequence/model';
import * as ops from '@nautink/editors/sequence/ops';
import { addParticipant as addedParticipant } from '@nautink/editors/sequence/participants';
import { endSlot, slotAfter } from '@nautink/editors/sequence/steps';

import { apply, wrapRows } from './sequence-actions.ts';
import { participantName } from './sequence-names.ts';
import { itemSelection, participantSelection } from './sequence-types.ts';

import type { SequenceActionContext } from './sequence-actions.ts';
import type { SequenceSelection } from './sequence-types.ts';
import type { Edited } from '@nautink/editors/sequence/ops';
import type { Slot } from '@nautink/editors/sequence/tree';
import type {
  BlockKind,
  MessageItem,
  NoteItem,
  NotePlacement,
  ParticipantKind,
  SequenceItem,
  SequenceModel,
} from '@nautink/editors/sequence/types';

/** Where new rows go: after the last selected row, else at the end. */
export function insertSlot(model: SequenceModel, selection: SequenceSelection): Slot {
  const last: string | undefined = selection.kind === 'items' ? selection.ids.at(-1) : undefined;
  return last === undefined ? endSlot(model) : slotAfter(model, last);
}

function participantIndex(model: SequenceModel, selection: SequenceSelection): number {
  const selected: number =
    selection.kind === 'participant'
      ? model.participants.findIndex((participant) => participant.id === selection.ids[0])
      : -1;
  return selected >= 0 ? selected + 1 : model.participants.length;
}

/** Adds a participant of `kind` after the selected one (or at `index`), named for typing. */
export function addParticipant(
  context: SequenceActionContext,
  kind: ParticipantKind,
  index?: number,
): void {
  const result: Edited | null = apply(
    context,
    (model) =>
      addedParticipant(model, {
        kind,
        index: index ?? participantIndex(model, context.getSelection()),
      }),
    (...[, added]: [SequenceModel, Edited]) =>
      `Added ${KIND_NAMES[kind].toLowerCase()} ${added.id}`,
  );
  if (result !== null) {
    context.select(participantSelection(result.id));
    context.edit({ kind: 'participant', id: result.id });
  }
}

function insertRow(context: SequenceActionContext, row: MessageItem | NoteItem, slot: Slot): void {
  const result: SequenceModel | null = apply(
    context,
    (model) => ops.insertItem(model, slot, row),
    (model) =>
      row.t === 'msg'
        ? `Added message ${participantName(model, row.from)} → ${participantName(model, row.to)}`
        : `Added note on ${participantName(model, row.actors[0] ?? '')}`,
  );
  if (result !== null) {
    context.select(itemSelection([row.id], row.id));
    context.edit({ kind: row.t === 'msg' ? 'message' : 'note', id: row.id });
  }
}

function lastRow(model: SequenceModel, selection: SequenceSelection): SequenceItem | undefined {
  const last: string | undefined = selection.kind === 'items' ? selection.ids.at(-1) : undefined;
  return last === undefined ? undefined : findItem(model, last)?.item;
}

// A participant and its right-hand neighbour (else its left one, else itself).
function withNeighbour(ids: readonly string[], at: number): [string, string] {
  const own: string = ids[at] ?? '';
  return [own, ids[at + 1] ?? ids[at - 1] ?? own];
}

// v1: from the selected participant to its neighbour, or answering the selected message.
function messageEnds(model: SequenceModel, selection: SequenceSelection): [string, string] {
  const ids: string[] = model.participants.map((participant) => participant.id);
  const row: SequenceItem | undefined = lastRow(model, selection);
  if (row?.t === 'msg') {
    return [row.to, row.from];
  }
  const at: number = selection.kind === 'participant' ? ids.indexOf(selection.ids[0] ?? '') : -1;
  return withNeighbour(ids, Math.max(0, at));
}

/** The toolbar's Message: after the selection, between sensible participants. */
export function addMessage(context: SequenceActionContext): void {
  const model: SequenceModel | null = context.getModel();
  if (model === null || model.participants.length === 0) {
    return;
  }
  const selection: SequenceSelection = context.getSelection();
  const [from, to] = messageEnds(model, selection);
  insertRow(context, ops.newMessage(from, to, { text: 'message' }), insertSlot(model, selection));
}

/** A message drawn from one lifeline to another (or the same one), at the slot it started from. */
export function addMessageAt(
  context: SequenceActionContext,
  link: { from: string; to: string; slot: Slot },
): void {
  insertRow(context, ops.newMessage(link.from, link.to), link.slot);
}

function noteActor(model: SequenceModel, selection: SequenceSelection): string {
  if (selection.kind === 'participant') {
    return selection.ids[0] ?? '';
  }
  const row: SequenceItem | undefined = lastRow(model, selection);
  if (row?.t === 'msg') {
    return row.to;
  }
  return row?.t === 'note' ? (row.actors[0] ?? '') : (model.participants[0]?.id ?? '');
}

/** The toolbar's Note: on the selected participant (or message target), after the selection. */
export function addNote(context: SequenceActionContext): void {
  const model: SequenceModel | null = context.getModel();
  if (model === null || model.participants.length === 0) {
    return;
  }
  const selection: SequenceSelection = context.getSelection();
  const actor: string = noteActor(model, selection);
  insertRow(context, ops.newNote([actor], 'right'), insertSlot(model, selection));
}

/** The inspector's "Add note": right of a participant, after a row or at the end. */
export function addNoteOn(context: SequenceActionContext, actor: string, afterId?: string): void {
  const model: SequenceModel | null = context.getModel();
  if (model !== null) {
    const slot: Slot = afterId === undefined ? endSlot(model) : slotAfter(model, afterId);
    insertRow(context, ops.newNote([actor], 'right'), slot);
  }
}

/** A note dropped on the canvas: beside the nearest lifeline, at the nearest slot. */
export function dropNote(
  context: SequenceActionContext,
  drop: { actor: string; placement: NotePlacement; slot: Slot },
): void {
  insertRow(context, ops.newNote([drop.actor], drop.placement), drop.slot);
}

/** A block from the toolbar or library: wraps the selected rows, or adds an empty one. */
export function wrapSelection(context: SequenceActionContext, kind: BlockKind): void {
  const selection: SequenceSelection = context.getSelection();
  wrapRows(context, selection.kind === 'items' ? selection.ids : [], kind);
}

/** A block dropped on the canvas: an empty one at the nearest slot. */
export function dropBlock(context: SequenceActionContext, kind: BlockKind, slot: Slot): void {
  const result: Edited | null = apply(
    context,
    (model) => {
      const added: Edited = ops.wrapItems(model, [], kind);
      return { model: ops.moveItems(added.model, [added.id], slot), id: added.id };
    },
    () => `Added ${kind} block`,
  );
  if (result !== null) {
    context.select(itemSelection([result.id]));
  }
}
