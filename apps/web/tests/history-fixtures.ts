import { FIRST_RUN_DONE_KEY, reloadFirstRun } from '../src/first-run/first-run-store.ts';
import { useSaveVersionDialogStore } from '../src/history/save-version-dialog-store.ts';
import { resetVersions } from '../src/history/versions-store.ts';
import { viewVersion } from '../src/history/viewed-version.ts';

/** Forgets the loaded versions, the viewed version and the save dialog between tests. */
export function resetHistoryState(): void {
  resetVersions();
  viewVersion(null);
  useSaveVersionDialogStore.setState({ isOpen: false, submitRequest: 0 });
}

/** Marks the first-run screen as left, so the app opens straight into the workspace. */
export function skipFirstRun(): void {
  window.localStorage.setItem(FIRST_RUN_DONE_KEY, '1');
  reloadFirstRun();
}

/** Forgets that the first-run screen was left, so a fresh workspace shows it. */
export function showFirstRun(): void {
  window.localStorage.removeItem(FIRST_RUN_DONE_KEY);
  reloadFirstRun();
}
