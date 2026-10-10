// Canvas shortcuts (v1's Enter to rename, plus PRD §9's keyboard moves): Enter, Esc, arrows, ⇧1.
// ⌘Z / ⌘⇧Z / ⌘Y stay with the app's history; the editor never binds them.
import { stateById } from '@nautink/editors/state/scopes';

import { nudgedIds } from './state-move.ts';
import { NO_SELECTION } from './state-types.ts';

import type { StateActionContext } from './state-actions.ts';
import type { StateSelection } from './state-types.ts';
import type { StateModel } from '@nautink/editors/state/types';
import type { Point } from '@nautink/visual-core/geometry';

export interface StateKeyDeps {
  selection: StateSelection;
  context: StateActionContext;
  isReadOnly: boolean;
  setEditingId: (id: string | null) => void;
  setSelection: (selection: StateSelection) => void;
  fit: () => void;
}

const NUDGE_PX: number = 1;
const BIG_NUDGE_PX: number = 10;

const ARROWS: Readonly<Record<string, Point>> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/** React Flow moves a focused node with the arrows itself; the window only handles the rest. */
function isOnNode(event: KeyboardEvent): boolean {
  return event.target instanceof Element && event.target.closest('.react-flow__node') !== null;
}

function selectedIds(selection: StateSelection): string[] {
  return [...selection.nodes, ...(selection.group === null ? [] : [selection.group])];
}

function nudge(event: KeyboardEvent, deps: StateKeyDeps, model: StateModel): boolean {
  const direction: Point | undefined = ARROWS[event.key];
  const ids: string[] = selectedIds(deps.selection);
  if (direction === undefined || ids.length === 0 || isOnNode(event)) {
    return false;
  }
  const step: number = event.shiftKey ? BIG_NUDGE_PX : NUDGE_PX;
  const { positions } = deps.context;
  positions.move(nudgedIds(model, positions.get(), ids), {
    x: direction.x * step,
    y: direction.y * step,
  });
  return true;
}

/** The one item Enter renames: a plain state, a composite or a note (v1). */
function renamable(model: StateModel, selection: StateSelection): string | null {
  const [only] = selection.nodes;
  const id: string | null = selection.nodes.length === 1 ? (only ?? null) : selection.group;
  const isNamed: boolean =
    id !== null &&
    (model.notes.some((note) => note.id === id) || stateById(model, id)?.type === 'state');
  return selection.nodes.length > 1 || !isNamed ? null : id;
}

function editKey(event: KeyboardEvent, deps: StateKeyDeps): boolean {
  const model: StateModel | null = deps.context.getModel();
  if (model === null) {
    return false;
  }
  const id: string | null = event.key === 'Enter' ? renamable(model, deps.selection) : null;
  if (id !== null) {
    deps.setEditingId(id);
    return true;
  }
  return nudge(event, deps, model);
}

/** Handles one key on the canvas; true when it used it. */
export function handleStateKey(event: KeyboardEvent, deps: StateKeyDeps): boolean {
  if (event.shiftKey && event.code === 'Digit1' && !event.metaKey && !event.ctrlKey) {
    deps.fit();
    return true;
  }
  if (event.key === 'Escape') {
    deps.setSelection(NO_SELECTION);
    deps.setEditingId(null);
    return false;
  }
  return deps.isReadOnly ? false : editKey(event, deps);
}
