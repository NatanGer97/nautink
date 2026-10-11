import { useEffect } from 'react';

import { rejectProposal } from './review-actions.ts';
import { useReviewStore } from './review-store.ts';
import { agentName } from '../chat/agent-name.ts';
import { registerHistoryGuard } from '../workspace/undo/history-guard.ts';

import type { Proposal } from './review-store.ts';
import type { HistoryGuard } from '../workspace/undo/history-guard.ts';

/** What undo does while an agent's proposal is open (the top bar's tooltip says "Undo: …"). */
export function rejectInstead(name: string): string {
  return `Reject ${name}'s change`;
}

/**
 * While a proposal is open on a diagram, undo rejects it instead of changing the code under it,
 * and redo and the step menu do nothing (PRD §4.2).
 */
export const REVIEW_HISTORY_GUARD: HistoryGuard = {
  undoInstead: (diagramId: string): string | null => {
    const proposal: Proposal | undefined = useReviewStore.getState().open[diagramId];
    return proposal === undefined ? null : rejectInstead(agentName(proposal.agent));
  },
  runInstead: (diagramId: string): void => {
    rejectProposal(diagramId);
  },
  subscribe: (listener: () => void): (() => void) => useReviewStore.subscribe(listener),
};

/** Installs the review's history guard for as long as the app is mounted. */
export function useReviewHistoryGuard(): void {
  useEffect(() => registerHistoryGuard(REVIEW_HISTORY_GUARD), []);
}
