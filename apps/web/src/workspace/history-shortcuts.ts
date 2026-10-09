import { useEffect } from 'react';

import { useWorkspaceStore } from './use-workspace.ts';
import { matchesShortcut, SHORTCUTS } from '../lib/shortcuts.ts';

import type { WorkspaceStore } from './workspace-state.ts';
import type { KeyEventLike } from '../lib/shortcuts.ts';

/** A code editor that routes ⌘Z to the app's history marks its container with this attribute. */
export const APP_HISTORY_ATTRIBUTE: string = 'data-edit-history';

/** ⌘Z → undo, ⌘⇧Z or ⌘Y → redo, anything else → undefined. */
export function historyKeyAction(event: KeyEventLike): 'undo' | 'redo' | undefined {
  if (matchesShortcut(event, SHORTCUTS.undo)) {
    return 'undo';
  }
  if (matchesShortcut(event, SHORTCUTS.redo) || matchesShortcut(event, SHORTCUTS.redoAlt)) {
    return 'redo';
  }
  return undefined;
}

/**
 * True for inputs, text areas, selects and editable content, which keep the browser's own undo.
 * Inside an element marked `data-edit-history="app"` the app's history wins.
 */
export function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.closest(`[${APP_HISTORY_ATTRIBUTE}="app"]`) !== null) {
    return false;
  }
  return target.isContentEditable || target.matches('input, textarea, select');
}

/** Listens for ⌘Z / ⌘⇧Z / ⌘Y and runs the open diagram's undo or redo. */
export function useHistoryShortcuts(store: WorkspaceStore = useWorkspaceStore): void {
  useEffect(() => {
    // Capture phase, so an editor that binds ⌘Z itself cannot run its own undo first.
    const onKeyDown = (event: KeyboardEvent): void => {
      const action: 'undo' | 'redo' | undefined = historyKeyAction(event);
      if (action === undefined || event.isComposing || event.altKey || isTextField(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      store.getState()[action]();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return (): void => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [store]);
}
