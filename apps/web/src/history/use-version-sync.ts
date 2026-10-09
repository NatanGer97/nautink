import { useEffect } from 'react';

import { changedDiagramId, loadVersions, VERSIONS_CHANGED_EVENT } from './versions-store.ts';
import { viewVersion } from './viewed-version.ts';
import { showError } from '../lib/notices.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';
import { errorMessage } from '../workspace/workspace-context.ts';

async function refresh(diagramId: string): Promise<void> {
  try {
    await loadVersions(useWorkspaceStore.getState().requireDb(), diagramId);
  } catch (err) {
    showError(`Could not read the versions. ${errorMessage(err)}`);
  }
}

/** Reloads the open diagram's versions when `nautink:versions-changed` names it. */
function listenForChanges(): () => void {
  const onChanged = (event: Event): void => {
    const diagramId: string = changedDiagramId(event);
    if (diagramId !== '' && diagramId === useWorkspaceStore.getState().activeId) {
      void refresh(diagramId);
    }
  };
  window.addEventListener(VERSIONS_CHANGED_EVENT, onChanged);
  return (): void => {
    window.removeEventListener(VERSIONS_CHANGED_EVENT, onChanged);
  };
}

/**
 * Keeps the versions store on the open diagram: reloads when another diagram opens and when
 * `nautink:versions-changed` names the open one. Opening another diagram stops viewing a version.
 */
export function useVersionSync(): void {
  const activeId: string | null = useWorkspaceStore((state) => state.activeId);
  const isReady: boolean = useWorkspaceStore((state) => state.status === 'ready');
  useEffect(() => {
    viewVersion(null);
    if (isReady && activeId !== null) {
      void refresh(activeId);
    }
  }, [activeId, isReady]);
  useEffect(listenForChanges, []);
}
