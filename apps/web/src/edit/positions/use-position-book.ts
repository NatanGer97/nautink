import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

import { appPositionStore } from './app-position-store.ts';
import { PositionBook } from './position-book.ts';

import type { EditorPositionStore } from './app-position-store.ts';
import type { PositionSnapshot } from './position-book.ts';
import type { EditorId } from '@nautink/visual-core/editor-contract';

export interface PositionBookInput {
  diagramId: string;
  ns: EditorId;
  canSave: boolean;
  /** IndexedDB through the workspace unless a test passes another. */
  store?: EditorPositionStore;
}

export interface PositionBookState extends PositionSnapshot {
  book: PositionBook;
}

function reportError(message: string): void {
  toast.error(message);
}

/** One editor's positions for the open diagram: loaded on mount, saved after a pause, flushed on close. */
export function usePositionBook({
  diagramId,
  ns,
  canSave,
  store = appPositionStore,
}: PositionBookInput): PositionBookState {
  const [book] = useState<PositionBook>(
    () => new PositionBook({ store, key: { diagramId, ns }, canSave, onError: reportError }),
  );
  useEffect(() => {
    book.setCanSave(canSave);
  }, [book, canSave]);
  useLoadAndFlush(book);
  const snapshot: PositionSnapshot = useSyncExternalStore(book.subscribe, book.getSnapshot);
  return { ...snapshot, book };
}

/** Loads the saved positions on mount and writes a pending save on unmount. */
function useLoadAndFlush(book: PositionBook): void {
  useEffect(() => {
    void book.load();
    return (): void => {
      void book.flush();
    };
  }, [book]);
}
