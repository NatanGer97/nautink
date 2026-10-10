// Canvas shortcuts (v1's Enter to rename and Esc, plus PRD §9's keyboard moves): Enter, Esc, ⌘D,
// arrows, ⇧1. ⌘Z / ⌘⇧Z / ⌘Y stay with the app's history; the editor never binds them.
import { framedIds } from './class-boxes.ts';
import { duplicateClasses } from './class-item-actions.ts';
import { itemKind } from './class-names.ts';
import { NO_SELECTION } from './class-types.ts';

import type { ClassActionContext } from './class-action-context.ts';
import type { ClassEditing, ClassSelection } from './class-types.ts';
import type { ClassModel } from '@nautink/editors/class/types';
import type { Point } from '@nautink/visual-core/geometry';

export interface ClassKeyDeps {
  selection: ClassSelection;
  context: ClassActionContext;
  isReadOnly: boolean;
  setEditing: (editing: ClassEditing | null) => void;
  setSelection: (selection: ClassSelection) => void;
  move: (ids: readonly string[], delta: Point) => void;
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

/** What the arrows move: the selected items, and a selected namespace's content. */
function nudgedIds(model: ClassModel | null, selection: ClassSelection): string[] {
  const framed: string[] =
    model === null || selection.group === null ? [] : framedIds(model, selection.group);
  return [...new Set<string>([...selection.nodes, ...framed])];
}

function nudge(event: KeyboardEvent, deps: ClassKeyDeps): boolean {
  const direction: Point | undefined = ARROWS[event.key];
  const ids: string[] = nudgedIds(deps.context.getModel(), deps.selection);
  if (direction === undefined || ids.length === 0 || isOnNode(event)) {
    return false;
  }
  const step: number = event.shiftKey ? BIG_NUDGE_PX : NUDGE_PX;
  deps.move(ids, { x: direction.x * step, y: direction.y * step });
  return true;
}

/** Enter edits the one selected class's name or note's text in place. */
function startEditing(deps: ClassKeyDeps): boolean {
  const model: ClassModel | null = deps.context.getModel();
  const [only] = deps.selection.nodes;
  const kind: string | null =
    model === null || only === undefined || deps.selection.nodes.length !== 1
      ? null
      : itemKind(model, only);
  if (only === undefined || (kind !== 'class' && kind !== 'note')) {
    return false;
  }
  deps.setEditing({ id: only, part: kind === 'class' ? 'name' : 'note' });
  return true;
}

function editKey(event: KeyboardEvent, deps: ClassKeyDeps): boolean {
  if (event.key === 'Enter') {
    return startEditing(deps);
  }
  const isDuplicate: boolean = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd';
  if (isDuplicate && deps.selection.nodes.length > 0) {
    duplicateClasses(deps.context, deps.selection.nodes);
    return true;
  }
  return nudge(event, deps);
}

/** Handles one key on the canvas; true when it used it. */
export function handleClassKey(event: KeyboardEvent, deps: ClassKeyDeps): boolean {
  if (event.shiftKey && event.code === 'Digit1' && !event.metaKey && !event.ctrlKey) {
    deps.fit();
    return true;
  }
  if (event.key === 'Escape') {
    deps.setSelection(NO_SELECTION);
    deps.setEditing(null);
    return false;
  }
  return deps.isReadOnly ? false : editKey(event, deps);
}
