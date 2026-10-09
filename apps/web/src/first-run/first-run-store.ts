import { create } from 'zustand';

import { safeLocalStorage } from '../lib/safe-storage.ts';

import type { StoreApi, UseBoundStore } from 'zustand';

/** The `localStorage` key that remembers the first-run screen was left, so it never returns. */
export const FIRST_RUN_DONE_KEY: string = 'nautink.firstRunDone';

interface FirstRunData {
  isDone: boolean;
}

function readDone(): boolean {
  return safeLocalStorage.getItem(FIRST_RUN_DONE_KEY) === '1';
}

export const useFirstRunStore: UseBoundStore<StoreApi<FirstRunData>> = create<FirstRunData>()(
  () => ({ isDone: readDone() }),
);

/** Leaves the first-run screen for good (in this browser). */
export function finishFirstRun(): void {
  void safeLocalStorage.setItem(FIRST_RUN_DONE_KEY, '1');
  useFirstRunStore.setState({ isDone: true });
}

/** Reads the remembered choice again. For tests, after they change `localStorage`. */
export function reloadFirstRun(): void {
  useFirstRunStore.setState({ isDone: readDone() });
}
