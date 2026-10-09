import { readPositions, writePositions } from '@nautink/storage/positions';

import { useWorkspaceStore } from '../../workspace/use-workspace.ts';

import type { PositionMap as StoredPositions, NodePosition } from '@nautink/storage/records';
import type {
  Position,
  PositionKey,
  PositionMap,
  PositionStore,
} from '@nautink/visual-core/positions';

/** The part of the positions store an editor uses: one editor's positions for one diagram. */
export type EditorPositionStore = Pick<PositionStore, 'load' | 'save'>;

function fromStored(stored: StoredPositions): PositionMap {
  return Object.fromEntries(
    Object.entries(stored).map(([id, { x, y, l }]: [string, NodePosition]) => [
      id,
      typeof l === 'string' ? { x, y, l } : { x, y },
    ]),
  );
}

function toStored(positions: PositionMap): StoredPositions {
  return Object.fromEntries(
    Object.entries(positions).map(([id, position]: [string, Position]) => [id, { ...position }]),
  );
}

/**
 * Canvas positions in IndexedDB, through the workspace's open database: one record per diagram and
 * editor (`ns` = the editor id), as v1 kept `mc.positions.<diagramId>.<ns>`. Deleting, duplicating,
 * backing up and restoring a diagram already carry its positions (`@nautink/storage`).
 */
export const appPositionStore: EditorPositionStore = {
  load: async ({ diagramId, ns }: PositionKey): Promise<PositionMap> =>
    fromStored(await readPositions(useWorkspaceStore.getState().requireDb(), diagramId, ns)),
  save: async ({ diagramId, ns }: PositionKey, positions: PositionMap): Promise<void> => {
    await writePositions(useWorkspaceStore.getState().requireDb(), {
      diagramId,
      ns,
      positions: toStored(positions),
    });
  },
};
