import { useEffect } from 'react';

import { useWorkspaceStore } from './use-workspace.ts';

import type { WorkspaceStore } from './store/workspace-state.ts';

/** Writes queued changes when the page is hidden or closed. Returns the cleanup. */
export function flushOnPageHide(store: WorkspaceStore): () => void {
  const flush = (): void => {
    void store.getState().flushSaves();
  };
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      flush();
    }
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', onVisibilityChange);
  return (): void => {
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

/**
 * Loads the workspace once the app mounts, and flushes autosave when the page is hidden or
 * closed, since a debounced save could otherwise be lost.
 */
export function useWorkspaceLifecycle(store: WorkspaceStore = useWorkspaceStore): void {
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  useEffect(() => flushOnPageHide(store), [store]);
}
