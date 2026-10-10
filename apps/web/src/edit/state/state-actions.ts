// Every state edit as a labelled undo step (v1's StateEditor `actions`, `renameId`, `deleteIds`,
// `onConnect`, `ctx.rename`). Pure of React: each action reads the newest model when it runs.
import { dagreLayout, placeNote } from '@nautink/editors/state/layout';
import * as ops from '@nautink/editors/state/ops';
import { displayName, isValidId, pseudoOf, stateById } from '@nautink/editors/state/scopes';
import { deleteLabel, editLabel } from '@nautink/visual-core/labels';
import { clip } from '@nautink/visual-core/text';

import { stateName, transitionName } from './state-names.ts';
import { renamedPositions } from './state-positions.ts';
import { NO_SELECTION } from './state-types.ts';

import type { StateSelection } from './state-types.ts';
import type {
  StateDirection,
  StateModel,
  StateNode,
  StateNote,
  StateTransition,
} from '@nautink/editors/state/types';
import type { Point } from '@nautink/visual-core/geometry';
import type { PositionMap } from '@nautink/visual-core/positions';

export interface StateActionContext {
  getModel: () => StateModel | null;
  /** Records `next` as one undo step; leaves without a spot get one first. */
  commit: (next: StateModel, label: string) => void;
  /** Shows a change only the canvas has (a [*] with no transition yet) without writing code. */
  setModel: (next: StateModel) => void;
  positions: {
    get: () => PositionMap;
    set: (id: string, point: Point) => void;
    move: (ids: readonly string[], delta: Point) => void;
    replace: (positions: PositionMap) => void;
  };
  select: (selection: StateSelection) => void;
  setEditingId: (id: string | null) => void;
  requestFit: () => void;
}

const NAME_CLIP: number = 28;

type Edit = (model: StateModel) => [StateModel, string];

/** Runs one edit on the newest model and commits it with its label. */
export function run(context: StateActionContext, edit: Edit): void {
  const model: StateModel | null = context.getModel();
  if (model !== null) {
    const [next, label] = edit(model);
    context.commit(next, label);
  }
}

export function updateState(
  context: StateActionContext,
  id: string,
  patch: Partial<StateNode>,
): void {
  run(context, (m) => [ops.updateState(m, id, patch), editLabel('state', stateName(m, id), patch)]);
}

export function updateTransition(
  context: StateActionContext,
  id: string,
  patch: Partial<StateTransition>,
): void {
  run(context, (m) => [
    ops.updateTransition(m, id, patch),
    editLabel('transition', transitionName(m, id), patch),
  ]);
}

export function reverseTransition(context: StateActionContext, id: string): void {
  run(context, (m) => [
    ops.reverseTransition(m, id),
    `Reversed transition ${transitionName(m, id)}`,
  ]);
}

/** Changes the diagram's direction and lays it out again in it (v1). */
export function setDirection(context: StateActionContext, direction: StateDirection): void {
  const model: StateModel | null = context.getModel();
  if (model === null || (model.direction || 'TB') === direction) {
    return;
  }
  const next: StateModel = { ...model, direction };
  context.positions.replace({ ...context.positions.get(), ...dagreLayout(next) });
  context.commit(next, `Changed direction to ${direction}`);
  context.requestFit();
}

/** The names a delete step lists: transitions that go with their states are not counted (v1). */
export function deletedNames(model: StateModel, selection: StateSelection): string[] {
  const ids: string[] = [
    ...selection.nodes,
    ...(selection.group === null ? [] : [selection.group]),
  ];
  const own: string[] = selection.edges.filter((id: string) => {
    const transition: StateTransition | undefined = model.transitions.find((t) => t.id === id);
    return (
      transition !== undefined && !ids.includes(transition.from) && !ids.includes(transition.to)
    );
  });
  return [
    ...ids.map((id: string) =>
      model.notes.some((n) => n.id === id) ? 'note' : stateName(model, id),
    ),
    ...own.map((id: string) => `transition ${transitionName(model, id)}`),
  ];
}

function deletion(model: StateModel, selection: StateSelection): ops.StateSelection {
  const ids: string[] = [
    ...selection.nodes,
    ...(selection.group === null ? [] : [selection.group]),
  ];
  return {
    stateIds: ids.filter((id: string) => stateById(model, id)),
    noteIds: ids.filter((id: string) => model.notes.some((note: StateNote) => note.id === id)),
    pseudoIds: ids.filter((id: string) => pseudoOf(id)),
    transitionIds: selection.edges,
  };
}

/** Deletes the selection as one step: states with what is inside them, notes, [*] and transitions. */
export function deleteSelection(context: StateActionContext, selection: StateSelection): void {
  const isEmpty: boolean =
    selection.nodes.length === 0 && selection.edges.length === 0 && selection.group === null;
  if (isEmpty) {
    return;
  }
  run(context, (m) => [
    ops.deleteItems(m, deletion(m, selection)),
    deleteLabel(deletedNames(m, selection)),
  ]);
  context.select(NO_SELECTION);
}

/** Can a transition run between these two canvas items? Swapped ends count (v1's `checkTransition`). */
export function canConnect(model: StateModel | null, source: string, target: string): boolean {
  const isEnd = (id: string): boolean =>
    Boolean(pseudoOf(id) ?? stateById(model ?? { states: [] }, id));
  return (
    model !== null &&
    isEnd(source) &&
    isEnd(target) &&
    ops.checkTransition(model, source, target) !== null
  );
}

/** Adds a transition (dragged from a handle onto another item) and selects it. */
export function connect(context: StateActionContext, source: string, target: string): void {
  const model: StateModel | null = context.getModel();
  const pair: { from: string; to: string } | null =
    model !== null && canConnect(model, source, target)
      ? ops.checkTransition(model, source, target)
      : null;
  if (model === null || pair === null) {
    return;
  }
  const next: StateModel = ops.addTransition(model, pair);
  context.commit(next, `Connected ${stateName(model, pair.from)} → ${stateName(model, pair.to)}`);
  context.select({ ...NO_SELECTION, edges: [next.transitions.at(-1)?.id ?? ''] });
}

/**
 * Changes a state's id everywhere, its saved spots included. False when the id is not valid or
 * is taken. A selected frame stays selected under its new id.
 */
export function renameId(
  context: StateActionContext,
  ids: { from: string; to: string },
  selection: StateSelection = NO_SELECTION,
): boolean {
  const model: StateModel | null = context.getModel();
  const { from, to } = ids;
  if (model === null || !isValidId(to) || stateById(model, to) !== undefined || from === to) {
    return false;
  }
  context.positions.replace(renamedPositions(context.positions.get(), from, to));
  context.commit(
    ops.renameState(model, from, to),
    `Renamed ${clip(from, NAME_CLIP)} → ${clip(to, NAME_CLIP)}`,
  );
  context.select(
    selection.group === from ? { ...NO_SELECTION, group: to } : { ...NO_SELECTION, nodes: [to] },
  );
  return true;
}

/** Edits a note; clearing its text deletes it. A new side puts it beside its state again. */
export function updateNote(
  context: StateActionContext,
  id: string,
  patch: Partial<StateNote>,
): void {
  const model: StateModel | null = context.getModel();
  if (model === null) {
    return;
  }
  if (patch.text?.trim() === '') {
    deleteSelection(context, { ...NO_SELECTION, nodes: [id] });
    return;
  }
  const next: StateModel = ops.updateNote(model, id, patch);
  if (patch.side !== undefined) {
    context.positions.replace(placeNote(next, context.positions.get(), id));
  }
  context.commit(next, patch.side === undefined ? 'Edited note' : 'Moved note');
}

function renameState(context: StateActionContext, state: StateNode, text: string): void {
  const name: string = text.replace(/\s*\n\s*/g, ' ').trim();
  const model: StateModel | null = context.getModel();
  if (model === null || name === '' || name === displayName(state)) {
    return;
  }
  const isNewId: boolean = state.name === '' && isValidId(name) && !stateById(model, name);
  if (isNewId) {
    renameId(context, { from: state.id, to: name }, { ...NO_SELECTION, nodes: [state.id] });
    return;
  }
  context.commit(
    ops.updateState(model, state.id, { name: name === state.id ? '' : name }),
    `Renamed ${clip(displayName(state), NAME_CLIP)} → ${clip(name, NAME_CLIP)}`,
  );
}

/**
 * Renames from the inline editor (v1's `ctx.rename`): a note gets the text; a state without a
 * display name takes the text as its id when it can, else as its display name.
 */
export function renameInline(context: StateActionContext, id: string, text: string): void {
  const model: StateModel | null = context.getModel();
  const note: StateNote | undefined = model?.notes.find((item: StateNote) => item.id === id);
  if (note !== undefined) {
    if (text !== note.text) {
      updateNote(context, id, { text });
    }
    return;
  }
  const state: StateNode | undefined = model ? stateById(model, id) : undefined;
  if (state !== undefined) {
    renameState(context, state, text);
  }
}

/** Wraps states in a new composite and selects its frame. */
export function wrap(context: StateActionContext, ids: readonly string[]): void {
  const model: StateModel | null = context.getModel();
  const { model: next, id } =
    model === null ? { model, id: null } : ops.wrapInComposite(model, ids);
  if (next === null || id === null) {
    return;
  }
  const noun: string = ids.length === 1 ? 'state' : 'states';
  context.commit(next, `Wrapped ${String(ids.length)} ${noun} in ${id}`);
  context.select({ ...NO_SELECTION, group: id });
}

/** Removes a composite and keeps its children. */
export function ungroup(context: StateActionContext, id: string): void {
  run(context, (m) => [ops.ungroup(m, id), `Ungrouped ${stateName(m, id)}`]);
  context.select(NO_SELECTION);
}
