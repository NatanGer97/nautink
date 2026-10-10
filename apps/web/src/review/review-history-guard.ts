import { useEffect } from 'react';

import { rejectProposal } from './review-actions.ts';
import { useReviewStore } from './review-store.ts';
import { registerHistoryGuard } from '../workspace/history-guard.ts';

import type { HistoryGuard } from '../workspace/history-guard.ts';

/** What undo does while Claude's proposal is open (the top bar's tooltip says "Undo: …"). */
export const REJECT_INSTEAD: string = "Reject Claude's change";

/**
 * While a proposal is open on a diagram, undo rejects it instead of changing the code under it,
 * and redo and the step menu do nothing (PRD §4.2).
 */
export const REVIEW_HISTORY_GUARD: HistoryGuard = {
  undoInstead: (diagramId: string): string | null =>
    diagramId in useReviewStore.getState().open ? REJECT_INSTEAD : null,
  runInstead: (diagramId: string): void => {
    rejectProposal(diagramId);
  },
  subscribe: (listener: () => void): (() => void) => useReviewStore.subscribe(listener),
};

/** Installs the review's history guard for as long as the app is mounted. */
export function useReviewHistoryGuard(): void {
  useEffect(() => registerHistoryGuard(REVIEW_HISTORY_GUARD), []);
}
