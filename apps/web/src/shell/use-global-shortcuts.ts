import { useEffect } from 'react';

import { matchesShortcut, SHORTCUTS } from '../lib/shortcuts.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { KeyEventLike } from '../lib/shortcuts.ts';
import type { UiState } from '../state/ui-store.ts';

/**
 * Runs the app-wide shortcut for `event`, if there is one, and says whether it did. Esc is not
 * here: every overlay is a Radix primitive that already closes on it.
 */
export function runGlobalShortcut(event: KeyEventLike, state: UiState): boolean {
  if (matchesShortcut(event, SHORTCUTS.palette)) {
    state.setPaletteOpen(!state.isPaletteOpen);
    return true;
  }
  if (matchesShortcut(event, SHORTCUTS.focusComposer)) {
    state.focusComposer();
    return true;
  }
  return false;
}

/** Listens for the global shortcuts (⌘K, ⌘/) while the app is mounted. */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    // Capture phase, so an editor that binds ⌘K itself (Monaco does) cannot swallow it first.
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.isComposing && runGlobalShortcut(event, useUiStore.getState())) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return (): void => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);
}
