import { create } from 'zustand';

import type { StoreApi, UseBoundStore } from 'zustand';

interface SaveVersionDialogData {
  isOpen: boolean;
  /** Bumped by ⌘S while the dialog is open: the dialog saves. */
  submitRequest: number;
}

export const useSaveVersionDialogStore: UseBoundStore<StoreApi<SaveVersionDialogData>> =
  create<SaveVersionDialogData>()(() => ({ isOpen: false, submitRequest: 0 }));

/** Opens the "Save version" dialog. */
export function openSaveVersionDialog(): void {
  useSaveVersionDialogStore.setState({ isOpen: true });
}

/** Closes the "Save version" dialog. */
export function closeSaveVersionDialog(): void {
  useSaveVersionDialogStore.setState({ isOpen: false });
}

/** ⌘S: opens the dialog, or saves when it is already open (as v1). */
export function pressSaveVersion(): void {
  useSaveVersionDialogStore.setState((state) =>
    state.isOpen ? { submitRequest: state.submitRequest + 1 } : { isOpen: true },
  );
}
