import { listVersions } from '@nautink/storage/versions';
import { create } from 'zustand';

import type { NautinkDb } from '@nautink/storage/db';
import type { Version } from '@nautink/storage/records';
import type { StoreApi, UseBoundStore } from 'zustand';

/** Fired on `window` after a diagram's versions change (a Claude edit, a save, a restore). */
export const VERSIONS_CHANGED_EVENT: string = 'nautink:versions-changed';

/** The `detail` of `VERSIONS_CHANGED_EVENT`. */
export interface VersionsChangedDetail {
  diagramId: string;
}

/** The open diagram's versions, newest first; `null` while they load. */
export interface VersionsData {
  diagramId: string | null;
  versions: readonly Version[] | null;
}

const EMPTY_VERSIONS: VersionsData = { diagramId: null, versions: null };

/** The versions of the open diagram, kept in step by `useVersionSync`. */
export const useVersionsStore: UseBoundStore<StoreApi<VersionsData>> = create<VersionsData>()(
  () => EMPTY_VERSIONS,
);

/** Tells the history panel (and anything else listening) that `diagramId`'s versions changed. */
export function announceVersionsChanged(diagramId: string): void {
  const detail: VersionsChangedDetail = { diagramId };
  window.dispatchEvent(new CustomEvent(VERSIONS_CHANGED_EVENT, { detail }));
}

/** The diagram id of a `VERSIONS_CHANGED_EVENT`, or '' when the event carries none. */
export function changedDiagramId(event: Event): string {
  const detail: unknown = event instanceof CustomEvent ? event.detail : undefined;
  const diagramId: unknown =
    typeof detail === 'object' && detail !== null && 'diagramId' in detail
      ? detail.diagramId
      : undefined;
  return typeof diagramId === 'string' ? diagramId : '';
}

/** Reads `diagramId`'s versions into the store; a load for a diagram no longer shown is dropped. */
export async function loadVersions(db: NautinkDb, diagramId: string): Promise<void> {
  if (useVersionsStore.getState().diagramId !== diagramId) {
    useVersionsStore.setState({ diagramId, versions: null });
  }
  const versions: Version[] = await listVersions(db, diagramId);
  if (useVersionsStore.getState().diagramId === diagramId) {
    useVersionsStore.setState({ versions });
  }
}

/** How many versions the open diagram has, or `null` while they load. For the status bar. */
export function useVersionCount(): number | null {
  return useVersionsStore((state) => state.versions?.length ?? null);
}

/** "1 version", "12 versions". */
export function versionCountLabel(count: number): string {
  return count === 1 ? '1 version' : `${String(count)} versions`;
}

/** Forgets the loaded versions. For tests. */
export function resetVersions(): void {
  useVersionsStore.setState(EMPTY_VERSIONS);
}
