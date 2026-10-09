// Canvas shortcuts (v1's Enter to rename, plus PRD §9's keyboard moves): Enter, Esc, ⌘D, arrows, ⇧1.
// ⌘Z / ⌘⇧Z / ⌘Y stay with the app's history (`history-shortcuts.ts`); the editor never binds them.
import { duplicateNodes } from './flow-actions.ts';
import { NO_SELECTION } from './flow-types.ts';

import type { FlowActionContext } from './flow-actions.ts';
import type { FlowSelection } from './flow-types.ts';
import type { Point } from '@nautink/visual-core/geometry';

export interface FlowKeyDeps {
  selection: FlowSelection;
  context: FlowActionContext;
  isReadOnly: boolean;
  setEditingId: (id: string | null) => void;
  setSelection: (selection: FlowSelection) => void;
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

function nudge(event: KeyboardEvent, deps: FlowKeyDeps): boolean {
  const direction: Point | undefined = ARROWS[event.key];
  if (direction === undefined || deps.selection.nodes.length === 0 || isOnNode(event)) {
    return false;
  }
  const step: number = event.shiftKey ? BIG_NUDGE_PX : NUDGE_PX;
  deps.move(deps.selection.nodes, { x: direction.x * step, y: direction.y * step });
  return true;
}

function editKey(event: KeyboardEvent, deps: FlowKeyDeps): boolean {
  const [only] = deps.selection.nodes;
  if (event.key === 'Enter' && deps.selection.nodes.length === 1 && only !== undefined) {
    deps.setEditingId(only);
    return true;
  }
  const isDuplicate: boolean = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd';
  if (isDuplicate && deps.selection.nodes.length > 0) {
    duplicateNodes(deps.context, deps.selection.nodes);
    return true;
  }
  return nudge(event, deps);
}

/** Handles one key on the canvas; true when it used it. */
export function handleFlowKey(event: KeyboardEvent, deps: FlowKeyDeps): boolean {
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
