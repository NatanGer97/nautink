import { describe, expect, it } from 'vitest';

import { appPositionStore } from './app-position-store.ts';
import { useWorkspaceStore } from '../../workspace/use-workspace.ts';

describe('appPositionStore', () => {
  it('keeps each editor’s positions per diagram in IndexedDB, label tags included', async () => {
    await useWorkspaceStore.getState().load();
    const key = { diagramId: 'd1', ns: 'flow' } as const;
    expect(await appPositionStore.load(key)).toEqual({});
    await appPositionStore.save(key, { A: { x: 1, y: 2, l: 'Start' }, B: { x: 3, y: 4 } });
    expect(await appPositionStore.load(key)).toEqual({
      A: { x: 1, y: 2, l: 'Start' },
      B: { x: 3, y: 4 },
    });
    expect(await appPositionStore.load({ diagramId: 'd1', ns: 'class' })).toEqual({});
  });
});
