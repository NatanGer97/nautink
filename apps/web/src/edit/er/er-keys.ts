// Canvas shortcuts (v1's Enter to rename, plus PRD §9's keyboard moves): Enter, Esc, arrows, ⇧1.
// ⌘Z / ⌘⇧Z / ⌘Y stay with the app's history; the editor never binds them.
import { NO_SELECTION } from './er-types.ts';

import type { ErCanvasSelection } from './er-types.ts';
import type { Point } from '@nautink/visual-core/geometry';

export interface ErKeyDeps {
  selection: ErCanvasSelection;
  isReadOnly: boolean;
  setEditingId: (id: string | null) => void;
  setSelection: (selection: ErCanvasSelection) => void;
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

function nudge(event: KeyboardEvent, deps: ErKeyDeps): boolean {
  const direction: Point | undefined = ARROWS[event.key];
  if (direction === undefined || deps.selection.entities.length === 0 || isOnNode(event)) {
    return false;
  }
  const step: number = event.shiftKey ? BIG_NUDGE_PX : NUDGE_PX;
  deps.move(deps.selection.entities, { x: direction.x * step, y: direction.y * step });
  return true;
}

/** The one entity, or else the one relationship, Enter edits in place. */
function editTarget(selection: ErCanvasSelection): string | undefined {
  if (selection.entities.length === 1) {
    return selection.entities[0];
  }
  return selection.entities.length === 0 && selection.rels.length === 1
    ? selection.rels[0]
    : undefined;
}

function editKey(event: KeyboardEvent, deps: ErKeyDeps): boolean {
  const target: string | undefined = editTarget(deps.selection);
  if (event.key === 'Enter' && target !== undefined) {
    deps.setEditingId(target);
    return true;
  }
  return nudge(event, deps);
}

/** Handles one key on the canvas; true when it used it. */
export function handleErKey(event: KeyboardEvent, deps: ErKeyDeps): boolean {
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
