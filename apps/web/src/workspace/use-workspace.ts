import { createDefaultWorkspaceDeps } from './store/default-workspace-deps.ts';
import { createWorkspaceStore } from './store/workspace-store.ts';

import type { SaveState } from './store/autosave.ts';
import type { WorkspaceData, WorkspaceStore } from './store/workspace-state.ts';
import type { EditStack } from './undo/edit-history.ts';
import type { Diagram } from '@nautink/storage/records';

/** The app's workspace store. Read it with the hooks below or with a selector. */
export const useWorkspaceStore: WorkspaceStore = createWorkspaceStore(createDefaultWorkspaceDeps());

/** The open diagram, or undefined while the workspace loads. */
export function selectActiveDiagram(state: WorkspaceData): Diagram | undefined {
  return state.diagrams.find((diagram) => diagram.id === state.activeId);
}

/** The open diagram's undo/redo stack, or undefined while the workspace loads. */
export function selectActiveStack(state: WorkspaceData): EditStack | undefined {
  return state.activeId === null ? undefined : state.histories[state.activeId];
}

/** The open diagram, re-rendering when it changes. */
export function useActiveDiagram(): Diagram | undefined {
  return useWorkspaceStore(selectActiveDiagram);
}

/** The open diagram's undo/redo stack. */
export function useActiveEditStack(): EditStack | undefined {
  return useWorkspaceStore(selectActiveStack);
}

/** "Saved", "Saving…" or "Not saved" as a state. */
export function useSaveState(): SaveState {
  return useWorkspaceStore((state) => state.saveState);
}
