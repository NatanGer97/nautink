import { useEffect } from 'react';

import { pressSaveVersion } from './save-version-dialog-store.ts';
import { matchesShortcut, SHORTCUTS } from '../lib/shortcuts.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

/** ⌘S anywhere (even in a text field or the code editor) saves a version, not the web page. */
export function useSaveVersionShortcut(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.isComposing || event.altKey || !matchesShortcut(event, SHORTCUTS.saveVersion)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (useWorkspaceStore.getState().activeId !== null) {
        pressSaveVersion();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return (): void => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);
}
