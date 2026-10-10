// Canvas shortcuts (v1's Esc, Delete and Enter, plus PRD §9's keyboard moves): ↑ ↓ move rows one
// step, ← → move a participant one column, ⇧1 fits. ⌘Z / ⌘⇧Z / ⌘Y stay with the app's history.
import { findItem } from '@nautink/editors/sequence/model';

import { deleteSelection, stepParticipant, stepRows } from './sequence-moves.ts';
import { NO_SELECTION } from './sequence-types.ts';

import type { SequenceActionContext } from './sequence-actions.ts';
import type { EditTarget, SequenceSelection } from './sequence-types.ts';
import type { StepDirection } from '@nautink/editors/sequence/steps';
import type { SequenceItem, SequenceModel } from '@nautink/editors/sequence/types';

export interface SequenceKeyDeps {
  context: SequenceActionContext;
  isReadOnly: boolean;
  fit: () => void;
}

const ROW_STEPS: Readonly<Record<string, StepDirection>> = { ArrowUp: -1, ArrowDown: 1 };
const COLUMN_STEPS: Readonly<Record<string, StepDirection>> = { ArrowLeft: -1, ArrowRight: 1 };

function rowTarget(item: SequenceItem | undefined): EditTarget | null {
  if (item?.t === 'msg' || item?.t === 'note') {
    return { kind: item.t === 'msg' ? 'message' : 'note', id: item.id };
  }
  return item?.t === 'block' && item.kind !== 'rect'
    ? { kind: 'section', id: item.id, sectionIndex: 0 }
    : null;
}

/** What Enter edits in place: a participant's name, a message, a note or a block's first label. */
export function editTargetOf(
  model: SequenceModel | null,
  selection: SequenceSelection,
): EditTarget | null {
  const [id] = selection.ids;
  if (model === null || id === undefined || selection.ids.length !== 1) {
    return null;
  }
  if (selection.kind === 'participant') {
    return { kind: 'participant', id };
  }
  return selection.kind === 'items' ? rowTarget(findItem(model, id)?.item) : null;
}

function stepKey(event: KeyboardEvent, context: SequenceActionContext): boolean {
  const selection: SequenceSelection = context.getSelection();
  const row: StepDirection | undefined = ROW_STEPS[event.key];
  const column: StepDirection | undefined = COLUMN_STEPS[event.key];
  const [only] = selection.ids;
  if (row !== undefined && selection.kind === 'items') {
    stepRows(context, selection.ids, row);
    return true;
  }
  if (column !== undefined && selection.kind === 'participant' && only !== undefined) {
    stepParticipant(context, only, column);
    return true;
  }
  return false;
}

function editKey(event: KeyboardEvent, context: SequenceActionContext): boolean {
  const selection: SequenceSelection = context.getSelection();
  if ((event.key === 'Delete' || event.key === 'Backspace') && selection.kind !== null) {
    deleteSelection(context);
    return true;
  }
  const target: EditTarget | null =
    event.key === 'Enter' ? editTargetOf(context.getModel(), selection) : null;
  if (target !== null) {
    context.edit(target);
    return true;
  }
  return stepKey(event, context);
}

/** Handles one key on the canvas; true when it used it. */
export function handleSequenceKey(event: KeyboardEvent, deps: SequenceKeyDeps): boolean {
  if (event.shiftKey && event.code === 'Digit1' && !event.metaKey && !event.ctrlKey) {
    deps.fit();
    return true;
  }
  if (event.key === 'Escape') {
    deps.context.select(NO_SELECTION);
    deps.context.edit(null);
    return false;
  }
  const hasModifier: boolean = event.metaKey || event.ctrlKey || event.altKey;
  return deps.isReadOnly || hasModifier ? false : editKey(event, deps.context);
}
