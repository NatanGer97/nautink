import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  historyOverride,
  registerHistoryGuard,
  runHistoryOverride,
  useHistoryOverride,
} from './history-guard.ts';

import type { HistoryGuard } from './history-guard.ts';

let unregister: (() => void) | null = null;

afterEach(() => {
  unregister?.();
  unregister = null;
});

/** A guard that holds the diagrams in `held`, and tells its listeners when that changes. */
function fakeGuard(): { guard: HistoryGuard; hold: (id: string) => void; runs: string[] } {
  const held: Set<string> = new Set<string>();
  const listeners: Set<() => void> = new Set<() => void>();
  const runs: string[] = [];
  const guard: HistoryGuard = {
    undoInstead: (id) => (held.has(id) ? 'Reject it' : null),
    runInstead: (id) => {
      runs.push(id);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const hold = (id: string): void => {
    held.add(id);
    listeners.forEach((listener) => {
      listener();
    });
  };
  return { guard, hold, runs };
}

describe('history guard', () => {
  it('lets the history run when no guard holds the diagram', () => {
    expect(historyOverride('d1')).toBeNull();
    expect(runHistoryOverride('d1')).toBe(false);
    const { guard } = fakeGuard();
    unregister = registerHistoryGuard(guard);
    expect(historyOverride(null)).toBeNull();
    expect(historyOverride('d1')).toBeNull();
    expect(runHistoryOverride(null)).toBe(false);
  });

  it('runs the guard instead of undo while it holds the diagram', () => {
    const { guard, hold, runs } = fakeGuard();
    unregister = registerHistoryGuard(guard);
    hold('d1');
    expect(historyOverride('d1')).toBe('Reject it');
    expect(runHistoryOverride('d1')).toBe(true);
    expect(runs).toEqual(['d1']);
    unregister();
    unregister = null;
    expect(historyOverride('d1')).toBeNull();
  });

  it('keeps React in step with the guard and its registration', () => {
    const { guard, hold } = fakeGuard();
    const { result } = renderHook(() => useHistoryOverride('d1'));
    expect(result.current).toBeNull();
    act(() => {
      unregister = registerHistoryGuard(guard);
    });
    act(() => {
      hold('d1');
    });
    expect(result.current).toBe('Reject it');
    act(() => {
      unregister?.();
      unregister = null;
    });
    expect(result.current).toBeNull();
  });

  it('removing an old guard leaves a newer one in place', () => {
    const first = fakeGuard();
    const second = fakeGuard();
    const removeFirst = registerHistoryGuard(first.guard);
    unregister = registerHistoryGuard(second.guard);
    second.hold('d1');
    removeFirst();
    expect(historyOverride('d1')).toBe('Reject it');
  });
});
