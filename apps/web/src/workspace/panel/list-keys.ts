import { nextCursor } from './diagram-list-model.ts';

import type { KeyboardEvent } from 'react';

/** What a key press on the diagram list asks for. */
export type ListKeyAction =
  { type: 'move' | 'open' | 'rename' | 'menu'; id: string } | { type: 'escape' };

type ListKey = Pick<KeyboardEvent, 'key' | 'shiftKey'>;

function cursorAction(event: ListKey, cursorId: string): ListKeyAction | undefined {
  if (event.key === 'Enter') {
    return { type: 'open', id: cursorId };
  }
  if (event.key === 'F2') {
    return { type: 'rename', id: cursorId };
  }
  if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
    return { type: 'menu', id: cursorId };
  }
  return undefined;
}

/**
 * Arrows, Home and End move the cursor; Enter opens, F2 renames and Shift+F10 (or the menu key)
 * opens the actions of the cursor row; Escape clears the search. Undefined for any other key.
 */
export function listKeyAction(
  event: ListKey,
  { ids, cursorId }: { ids: readonly string[]; cursorId: string | null },
): ListKeyAction | undefined {
  if (event.key === 'Escape') {
    return { type: 'escape' };
  }
  const moved: string | undefined = nextCursor(ids, cursorId, event.key);
  if (moved !== undefined) {
    return { type: 'move', id: moved };
  }
  return cursorId === null || !ids.includes(cursorId) ? undefined : cursorAction(event, cursorId);
}
