// A seam that lets another feature take over undo for a diagram without the workspace importing it.
// The review registers one: while Claude's proposal is open, undo rejects it and redo does nothing.
import { useSyncExternalStore } from 'react';

/** Something that takes over the history of a diagram for a while. */
export interface HistoryGuard {
  /** What undo does instead on `diagramId` ("Reject Claude's change"), or null to undo normally. */
  undoInstead: (diagramId: string) => string | null;
  /** Does it. Called by undo while `undoInstead` names something. */
  runInstead: (diagramId: string) => void;
  /** Calls `listener` whenever `undoInstead` may give a different answer. */
  subscribe: (listener: () => void) => () => void;
}

let current: HistoryGuard | null = null;
const listeners: Set<() => void> = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Installs `guard` (one at a time). The result removes it again. */
export function registerHistoryGuard(guard: HistoryGuard): () => void {
  current = guard;
  const unsubscribe: () => void = guard.subscribe(notify);
  notify();
  return (): void => {
    unsubscribe();
    if (current === guard) {
      current = null;
      notify();
    }
  };
}

/** What undo does instead on `diagramId` right now, or null when the history runs as usual. */
export function historyOverride(diagramId: string | null): string | null {
  return diagramId === null || current === null ? null : current.undoInstead(diagramId);
}

/** Runs the guard's undo for `diagramId`. Returns false when no guard takes it over. */
export function runHistoryOverride(diagramId: string | null): boolean {
  if (diagramId === null || historyOverride(diagramId) === null || current === null) {
    return false;
  }
  current.runInstead(diagramId);
  return true;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
}

/** `historyOverride` for `diagramId`, kept in step with the guard. */
export function useHistoryOverride(diagramId: string | null): string | null {
  return useSyncExternalStore(subscribe, () => historyOverride(diagramId));
}
