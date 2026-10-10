// Every sequence edit as a labelled undo step (v1's SequenceEditor `actions`). Pure of React: each
// action reads the newest model when it runs, and does nothing while the canvas is read-only.
import { findItem } from '@nautink/editors/sequence/model';
import * as ops from '@nautink/editors/sequence/ops';
import * as people from '@nautink/editors/sequence/participants';
import { editLabel } from '@nautink/visual-core/labels';
import { clip } from '@nautink/visual-core/text';

import { boxName, itemName, participantName, rowsLabel } from './sequence-names.ts';
import { itemSelection, NO_SELECTION, participantSelection } from './sequence-types.ts';

import type { EditTarget, SequenceSelection } from './sequence-types.ts';
import type { Edited, ItemPatch, SectionRef } from '@nautink/editors/sequence/ops';
import type {
  BlockKind,
  Participant,
  SequenceBox,
  SequenceItem,
  SequenceModel,
} from '@nautink/editors/sequence/types';

const NAME_CLIP: number = 24;

export interface SequenceActionContext {
  getModel: () => SequenceModel | null;
  commit: (next: SequenceModel, label: string) => void;
  isReadOnly: () => boolean;
  getSelection: () => SequenceSelection;
  select: (selection: SequenceSelection) => void;
  /** Opens (or closes, with null) the inline text editor on the canvas. */
  edit: (target: EditTarget | null) => void;
}

type EditResult = SequenceModel | Edited;

function modelOf(result: EditResult): SequenceModel {
  return 'model' in result ? result.model : result;
}

/**
 * Runs one edit on the newest model and commits it with its label (computed from the model
 * before the edit). Returns the edit's result, or null when nothing ran (read-only, no model).
 */
export function apply<Result extends EditResult>(
  context: SequenceActionContext,
  edit: (model: SequenceModel) => Result,
  label: (model: SequenceModel, result: Result) => string,
): Result | null {
  const model: SequenceModel | null = context.getModel();
  if (model === null || context.isReadOnly()) {
    return null;
  }
  const result: Result = edit(model);
  if (modelOf(result) !== model) {
    context.commit(modelOf(result), label(model, result));
  }
  return result;
}

export function updateParticipant(
  context: SequenceActionContext,
  id: string,
  patch: Partial<Participant>,
): void {
  apply(
    context,
    (model) => people.updateParticipant(model, id, patch),
    (model) => editLabel('participant', participantName(model, id), patch),
  );
}

/** Changes a participant's id everywhere it is used; an invalid or taken id changes nothing. */
export function renameParticipant(context: SequenceActionContext, from: string, to: string): void {
  const result: SequenceModel | null = apply(
    context,
    (model) => people.renameParticipant(model, from, to),
    () => `Renamed ${clip(from, NAME_CLIP)} → ${clip(to, NAME_CLIP)}`,
  );
  if (result?.participants.some((participant) => participant.id === to) === true) {
    context.select(participantSelection(to));
  }
}

export function setParticipantBox(
  context: SequenceActionContext,
  id: string,
  box: string | null,
): void {
  apply(
    context,
    (model) => people.setParticipantBox(model, id, box),
    (model) =>
      box === null
        ? `Moved ${participantName(model, id)} out of its box`
        : `Moved ${participantName(model, id)} into a box`,
  );
}

export function updateBox(
  context: SequenceActionContext,
  id: string,
  patch: Partial<SequenceBox>,
): void {
  apply(
    context,
    (model) => people.updateBox(model, id, patch),
    (model) => editLabel('box', boxName(model, id), patch),
  );
}

export function removeBox(context: SequenceActionContext, id: string): void {
  apply(
    context,
    (model) => people.removeBox(model, id),
    () => 'Removed box',
  );
  context.select(NO_SELECTION);
}

export function updateItem(context: SequenceActionContext, id: string, patch: ItemPatch): void {
  apply(
    context,
    (model) => ops.updateItem(model, id, patch),
    (model) => editLabel(itemName(model, id), '', patch),
  );
}

export function reverseMessage(context: SequenceActionContext, id: string): void {
  apply(
    context,
    (model) => ops.reverseMessage(model, id),
    (model) => `Reversed ${itemName(model, id)}`,
  );
}

export function setBlockKind(context: SequenceActionContext, id: string, kind: BlockKind): void {
  apply(
    context,
    (model) => ops.setBlockKind(model, id, kind),
    () => `Changed block to ${kind}`,
  );
}

export function setSectionLabel(
  context: SequenceActionContext,
  ref: SectionRef & { label: string },
): void {
  apply(
    context,
    (model) => ops.setSectionLabel(model, ref),
    (model) => `Edited label of ${itemName(model, ref.blockId)}`,
  );
}

export function addSection(context: SequenceActionContext, blockId: string): void {
  apply(
    context,
    (model) => ops.addSection(model, blockId),
    (model) => `Added section to ${itemName(model, blockId)}`,
  );
}

export function removeSection(context: SequenceActionContext, ref: SectionRef): void {
  apply(
    context,
    (model) => ops.removeSection(model, ref),
    (model) => `Removed section from ${itemName(model, ref.blockId)}`,
  );
}

function innerIds(item: SequenceItem | undefined): string[] {
  return item?.t === 'block'
    ? item.sections.flatMap((section) => section.items.map((inner) => inner.id))
    : [];
}

/** Removes a block, keeping its rows, and selects them. */
export function unwrapBlock(context: SequenceActionContext, id: string): void {
  const before: SequenceModel | null = context.getModel();
  const block: SequenceItem | undefined = before === null ? undefined : findItem(before, id)?.item;
  apply(
    context,
    (model) => ops.unwrap(model, id),
    () => (block?.t === 'block' ? `Unwrapped ${block.kind}` : 'Unwrapped block'),
  );
  const ids: string[] = innerIds(block);
  context.select(ids.length > 0 ? itemSelection(ids) : NO_SELECTION);
}

/** Wraps rows in a new block (or adds an empty one) and selects it. */
export function wrapRows(
  context: SequenceActionContext,
  ids: readonly string[],
  kind: BlockKind,
): void {
  const result: Edited | null = apply(
    context,
    (model) => ops.wrapItems(model, ids, kind),
    () => (ids.length > 0 ? `Wrapped ${rowsLabel(ids.length)} in ${kind}` : `Added ${kind} block`),
  );
  if (result !== null) {
    context.select(itemSelection([result.id]));
  }
}

export function setAutonumberStart(
  context: SequenceActionContext,
  id: string,
  start: number | undefined,
): void {
  apply(
    context,
    (model) => ops.setAutonumberStart(model, id, start),
    () =>
      start === undefined ? 'Continued the numbering' : `Restarted numbering at ${String(start)}`,
  );
}

export function toggleAutonumber(context: SequenceActionContext): void {
  apply(
    context,
    (model) => ops.toggleAutonumber(model),
    (model) => `Turned autonumber ${model.autonumber ? 'off' : 'on'}`,
  );
}
