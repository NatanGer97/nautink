import { create } from 'zustand';

import { deleteActions } from './delete-actions.ts';
import { editActions } from './edit-actions.ts';
import { fieldActions, requestActions } from './field-actions.ts';
import { importActions } from './import-actions.ts';
import { libraryActions } from './library-actions.ts';
import { loadAction } from './load-action.ts';
import { errorMessage } from './workspace-context.ts';
import { WorkspaceRuntime } from './workspace-runtime.ts';
import { INITIAL_WORKSPACE } from './workspace-state.ts';

import type { SaveState } from './autosave.ts';
import type { WorkspaceDeps } from './workspace-deps.ts';
import type { StoreContext, WorkspaceState, WorkspaceStore } from './workspace-state.ts';
import type { StoreApi } from 'zustand';

function createRuntime(
  deps: WorkspaceDeps,
  set: StoreApi<WorkspaceState>['setState'],
): WorkspaceRuntime {
  return new WorkspaceRuntime({
    delayMs: deps.saveDelayMs,
    onStateChange: (saveState: SaveState): void => {
      set({ saveState });
    },
    onError: (err: unknown): void => {
      deps.notify.error(`Could not save. ${errorMessage(err)}`);
    },
  });
}

/** A workspace store over `deps`. The app uses one (`useWorkspaceStore`); tests make their own. */
export function createWorkspaceStore(deps: WorkspaceDeps): WorkspaceStore {
  return create<WorkspaceState>()((set, get) => {
    const ctx: StoreContext = { set, get, deps, runtime: createRuntime(deps, set) };
    return {
      ...INITIAL_WORKSPACE,
      load: loadAction(ctx),
      ...libraryActions(ctx),
      ...importActions(ctx),
      ...deleteActions(ctx),
      ...editActions(ctx),
      ...fieldActions(ctx),
      ...requestActions(ctx, () => {
        set(INITIAL_WORKSPACE);
      }),
    };
  });
}
