import { describe, expect, it } from 'vitest';

import { MemoryPositionStore } from './positions.ts';

describe('MemoryPositionStore', () => {
  it('saves and loads positions per diagram and editor', async () => {
    const store = new MemoryPositionStore();
    await store.save({ diagramId: 'd1', ns: 'flow' }, { a: { x: 1, y: 2, l: 'A' } });
    expect(await store.load({ diagramId: 'd1', ns: 'flow' })).toEqual({
      a: { x: 1, y: 2, l: 'A' },
    });
    expect(await store.load({ diagramId: 'd1', ns: 'er' })).toEqual({});
    expect(await store.load({ diagramId: 'd2', ns: 'flow' })).toEqual({});
  });

  it('returns copies, not live state', async () => {
    const store = new MemoryPositionStore();
    const positions = { a: { x: 1, y: 2 } };
    await store.save({ diagramId: 'd', ns: 'flow' }, positions);
    positions.a.x = 99;
    const loaded = await store.load({ diagramId: 'd', ns: 'flow' });
    expect(loaded.a).toEqual({ x: 1, y: 2 });
  });

  it('reads, writes and deletes every editor of a diagram', async () => {
    const store = new MemoryPositionStore();
    await store.writeAll('d', { flow: { a: { x: 0, y: 0 } }, er: { E: { x: 5, y: 5 } } });
    await store.save({ diagramId: 'd', ns: 'state' }, { s: { x: 1, y: 1 } });
    expect(Object.keys(await store.readAll('d'))).toEqual(['flow', 'er', 'state']);
    await store.deleteAll('d');
    expect(await store.readAll('d')).toEqual({});
  });
});
