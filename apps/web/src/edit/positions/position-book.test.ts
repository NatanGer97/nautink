import { MemoryPositionStore } from '@nautink/visual-core/positions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POSITION_SAVE_DELAY_MS, PositionBook } from './position-book.ts';

import type { EditorPositionStore } from './app-position-store.ts';

const KEY = { diagramId: 'd1', ns: 'flow' } as const;

function createBook(
  store: EditorPositionStore,
  canSave: boolean = true,
): { book: PositionBook; onError: ReturnType<typeof vi.fn> } {
  const onError = vi.fn();
  return { book: new PositionBook({ store, key: KEY, canSave, onError }), onError };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PositionBook', () => {
  it('loads the saved positions once and saves changes after a pause', async () => {
    const store = new MemoryPositionStore();
    await store.save(KEY, { A: { x: 1, y: 2, l: 'Start' } });
    const { book } = createBook(store);
    const listener = vi.fn();
    book.subscribe(listener);
    await book.load();
    expect(book.getSnapshot()).toEqual({
      positions: { A: { x: 1, y: 2, l: 'Start' } },
      isLoaded: true,
    });
    book.set('A', { x: 10, y: 20 });
    book.set('B', { x: 5, y: 5 });
    expect(await store.load(KEY)).toEqual({ A: { x: 1, y: 2, l: 'Start' } });
    await vi.advanceTimersByTimeAsync(POSITION_SAVE_DELAY_MS);
    expect(await store.load(KEY)).toEqual({ A: { x: 10, y: 20, l: 'Start' }, B: { x: 5, y: 5 } });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('nudges known items only and flushes a pending save at once', async () => {
    const store = new MemoryPositionStore();
    const { book } = createBook(store);
    book.replace({ A: { x: 0, y: 0 }, B: { x: 10, y: 10 } });
    book.move(['A', 'missing'], { x: 1, y: -2 });
    expect(book.get()).toEqual({ A: { x: 1, y: -2 }, B: { x: 10, y: 10 } });
    await book.flush();
    expect(await store.load(KEY)).toEqual({ A: { x: 1, y: -2 }, B: { x: 10, y: 10 } });
    await book.flush();
  });

  it('never saves while an older version is on view', async () => {
    const store = new MemoryPositionStore();
    const { book } = createBook(store, false);
    book.set('A', { x: 3, y: 3 });
    await vi.advanceTimersByTimeAsync(POSITION_SAVE_DELAY_MS);
    expect(await store.load(KEY)).toEqual({});
    book.setCanSave(true);
    book.set('A', { x: 4, y: 4 });
    await vi.advanceTimersByTimeAsync(POSITION_SAVE_DELAY_MS);
    expect(await store.load(KEY)).toEqual({ A: { x: 4, y: 4 } });
  });

  it('reports a store that fails, and still opens the canvas', async () => {
    const failing: EditorPositionStore = {
      load: async () => Promise.reject(new Error('blocked')),
      save: async () => Promise.reject(new Error('full')),
    };
    const { book, onError } = createBook(failing);
    await book.load();
    expect(book.getSnapshot().isLoaded).toBe(true);
    book.set('A', { x: 1, y: 1 });
    await book.flush();
    expect(onError.mock.calls).toEqual([
      ['Could not load the canvas layout: blocked'],
      ['Could not save the canvas layout: full'],
    ]);
  });
});
