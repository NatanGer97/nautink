// Relation and note edits as labelled undo steps (v1's ClassEditor `actions`).
import { KINDS } from '@nautink/editors/class/model';
import * as ops from '@nautink/editors/class/ops';
import { noteFromEditor } from '@nautink/editors/class/text';
import { editLabel } from '@nautink/visual-core/labels';

import { movePosition, run } from './class-action-context.ts';
import { addNote, noteStart } from './class-actions.ts';
import { className, relationName } from './class-names.ts';
import { NO_SELECTION } from './class-types.ts';

import type { ClassActionContext } from './class-action-context.ts';
import type { ClassModel, ClassNote, ClassRelation } from '@nautink/editors/class/types';

export function updateRelation(
  context: ClassActionContext,
  id: string,
  patch: Partial<ClassRelation>,
): void {
  run(context, (model) => [
    ops.updateRelation(model, id, patch),
    editLabel('relation', relationName(model, id), patch),
  ]);
}

/** Applies a toolbar kind (inheritance, composition …), keeping the marker's end. */
export function setRelationKind(context: ClassActionContext, id: string, kindId: string): void {
  const name: string = (KINDS.find((kind) => kind.id === kindId)?.name ?? kindId).toLowerCase();
  run(context, (model) => [
    ops.setRelationKind(model, id, kindId),
    `Made ${relationName(model, id)} ${name}`,
  ]);
}

export function reverseRelation(context: ClassActionContext, id: string): void {
  run(context, (model) => [
    ops.reverseRelation(model, id),
    `Reversed relation ${relationName(model, id)}`,
  ]);
}

/** The inspector's "Add note": a note on the class, right of it, opened for editing. */
export function addNoteFor(context: ClassActionContext, classId: string): void {
  addNote(context, { forId: classId, ns: '', start: noteStart(context, classId, { x: 0, y: 0 }) });
}

/** Note text from the inspector or the canvas (newlines become `\n`). */
export function setNoteText(context: ClassActionContext, id: string, text: string): void {
  run(context, (model) => [
    ops.updateNote(model, id, { text: noteFromEditor(text) }).model,
    'Edited note',
  ]);
}

function noteLabel(model: ClassModel, patch: Partial<ClassNote>): string {
  if (patch.for === undefined) {
    return 'Edited note';
  }
  return patch.for === '' ? 'Detached note' : `Attached note to ${className(model, patch.for)}`;
}

/** Patches a note; re-attaching it gives it a new id, so its spot and the selection follow. */
export function updateNote(
  context: ClassActionContext,
  id: string,
  patch: Partial<ClassNote>,
): void {
  const model: ClassModel | null = context.getModel();
  if (model === null) {
    return;
  }
  const { model: next, id: newId } = ops.updateNote(model, id, patch);
  movePosition(context, id, newId);
  context.commit(next, noteLabel(model, patch));
  context.select({ ...NO_SELECTION, nodes: [newId] });
}
