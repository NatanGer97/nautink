import { create } from 'zustand';

import type { Version } from '@nautink/storage/records';
import type { StoreApi, UseBoundStore } from 'zustand';

/** The version picked in the history panel, shown read-only instead of the current code. */
export interface ViewedVersionData {
  version: Version | null;
  isCompareOpen: boolean;
}

const NOTHING_VIEWED: ViewedVersionData = { version: null, isCompareOpen: false };

export const useViewedVersionStore: UseBoundStore<StoreApi<ViewedVersionData>> =
  create<ViewedVersionData>()(() => NOTHING_VIEWED);

/**
 * The version the history panel is showing, or `null` for the current code. The canvas reads
 * this to show the version read-only (M5: "Viewing an older version · read-only").
 */
export function useViewedVersion(): Version | null {
  return useViewedVersionStore((state) => state.version);
}

/** Shows `version` (or the current code again for `null`); a new version closes the compare. */
export function viewVersion(version: Version | null): void {
  const { version: shown, isCompareOpen } = useViewedVersionStore.getState();
  const isSame: boolean = version !== null && shown?.id === version.id;
  useViewedVersionStore.setState({ version, isCompareOpen: isSame && isCompareOpen });
}

/** Opens or closes the compare drawer for the viewed version. */
export function setCompareOpen(isOpen: boolean): void {
  useViewedVersionStore.setState((state) => ({ isCompareOpen: isOpen && state.version !== null }));
}
