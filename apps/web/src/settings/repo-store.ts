import { create } from 'zustand';

import { fetchRepoDir, saveRepoDir } from './repo.ts';

import type { StoreApi, UseBoundStore } from 'zustand';

/** Where reading the setting from the server stands. */
export type RepoLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RepoState {
  /** The folder Claude can read; `null` when repo-aware mode is off. */
  repoDir: string | null;
  status: RepoLoadStatus;
  isSaving: boolean;
  /** Why the last save failed, shown under the field. */
  saveError: string | null;
  /** Reads the setting from the server. */
  load: () => Promise<void>;
  /** Saves a folder, or `null` to clear it. Resolves true when the server accepted it. */
  save: (path: string | null) => Promise<boolean>;
  clearSaveError: () => void;
}

type SetRepo = StoreApi<RepoState>['setState'];

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function loadAction(set: SetRepo): RepoState['load'] {
  return async (): Promise<void> => {
    set({ status: 'loading' });
    try {
      set({ repoDir: await fetchRepoDir(), status: 'ready' });
    } catch {
      set({ status: 'error' });
    }
  };
}

function saveAction(set: SetRepo): RepoState['save'] {
  return async (path: string | null): Promise<boolean> => {
    set({ isSaving: true, saveError: null });
    try {
      set({ repoDir: await saveRepoDir(path), status: 'ready', isSaving: false });
      return true;
    } catch (err) {
      set({ isSaving: false, saveError: errorText(err) });
      return false;
    }
  };
}

const INITIAL_REPO: Pick<RepoState, 'repoDir' | 'status' | 'isSaving' | 'saveError'> = {
  repoDir: null,
  status: 'idle',
  isSaving: false,
  saveError: null,
};

/** The codebase setting (PRD §3.1 repo-aware mode). The server owns it; this mirrors it. */
export const useRepoStore: UseBoundStore<StoreApi<RepoState>> = create<RepoState>()((set) => ({
  ...INITIAL_REPO,
  load: loadAction(set),
  save: saveAction(set),
  clearSaveError: (): void => {
    set({ saveError: null });
  },
}));

/** Back to "not loaded". For tests. */
export function resetRepoState(): void {
  useRepoStore.setState(INITIAL_REPO);
}
