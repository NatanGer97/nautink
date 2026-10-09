import { useSaveVersionDialogStore } from '../src/history/save-version-dialog-store.ts';
import { resetVersions } from '../src/history/versions-store.ts';
import { viewVersion } from '../src/history/viewed-version.ts';

/** Forgets the loaded versions, the viewed version and the save dialog between tests. */
export function resetHistoryState(): void {
  resetVersions();
  viewVersion(null);
  useSaveVersionDialogStore.setState({ isOpen: false, submitRequest: 0 });
}
