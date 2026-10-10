import { create } from 'zustand';

import type { ChatDeps } from '../chat/chat-deps.ts';
import type { StructuralReview } from '@nautink/editors/review/review-diagram';
import type { StoreApi, UseBoundStore } from 'zustand';

/** A proposal reviewed as a code diff: types without a visual editor, or code that does not parse. */
export interface CodeReview {
  kind: 'code';
  reason: string;
  /** Changed blocks of lines. */
  changes: number;
}

/** How a proposal is reviewed: on the canvas (structural) or as a code diff in the drawer. */
export type ProposalReview = StructuralReview | CodeReview;

/** Claude's change to one diagram, held until the user accepts or rejects it (PRD §4.2). */
export interface Proposal {
  /** Unique in the session, so a late review result never lands on a newer proposal. */
  id: number;
  diagramId: string;
  /** The code when the turn started. */
  before: string;
  /** The code Claude proposes. */
  after: string;
  /** What the user asked, saved with the version on Accept. */
  prompt: string;
  /** Names the undo step on Accept ("Claude: …"). */
  label: string;
  /** False when the proposal still has a syntax error: Accept then saves no version (as v1). */
  isValid: boolean;
  /** The turn's assistant messages; their change cards show the outcome. */
  replyIndexes: readonly number[];
  /** `null` while the comparison runs. */
  review: ProposalReview | null;
  /** The workspace, versions and notices the turn used. */
  deps: ChatDeps;
}

/** A reviewed turn while it runs: the code streaming in (live build, PRD §4.3) and its replies. */
export interface LiveBuild {
  code: string;
  replyIndexes: readonly number[];
}

export interface ReviewData {
  /** Diagram id → the turn streaming into it while review is on. */
  live: Readonly<Record<string, LiveBuild>>;
  /** Diagram id → the proposal waiting for Accept or Reject. One per diagram. */
  open: Readonly<Record<string, Proposal>>;
  /** Diagram id → reply index → a closed proposal, for "Show again" (this session only). */
  closed: Readonly<Record<string, Readonly<Record<number, Proposal>>>>;
}

export interface ReviewActions {
  showLive: (diagramId: string, build: LiveBuild) => void;
  clearLive: (diagramId: string) => void;
  /** Opens `proposal` on its diagram, replacing the live build. */
  openProposal: (proposal: Proposal) => void;
  /** Sets the comparison of the open proposal `proposalId`, if it is still open. */
  setReview: (diagramId: string, update: { proposalId: number; review: ProposalReview }) => void;
  /** Closes the open proposal and keeps it for "Show again". Returns it, or undefined. */
  closeProposal: (diagramId: string) => Proposal | undefined;
  /** Drops everything about a diagram (New chat). */
  forget: (diagramId: string) => void;
}

export type ReviewState = ReviewData & ReviewActions;

const INITIAL_REVIEW: ReviewData = { live: {}, open: {}, closed: {} };

type SetReview = StoreApi<ReviewState>['setState'];

function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([id]) => id !== key));
}

function liveActions(set: SetReview): Pick<ReviewActions, 'showLive' | 'clearLive'> {
  return {
    showLive: (diagramId, build): void => {
      set((state) => ({ live: { ...state.live, [diagramId]: build } }));
    },
    clearLive: (diagramId): void => {
      set((state) => ({ live: without(state.live, diagramId) }));
    },
  };
}

function keptFor(state: ReviewData, proposal: Proposal): Record<number, Proposal> {
  const kept: Record<number, Proposal> = { ...state.closed[proposal.diagramId] };
  for (const index of proposal.replyIndexes) {
    kept[index] = proposal;
  }
  return kept;
}

function closeAction(set: SetReview, get: () => ReviewState): ReviewActions['closeProposal'] {
  return (diagramId: string): Proposal | undefined => {
    const proposal: Proposal | undefined = get().open[diagramId];
    if (proposal !== undefined) {
      set((state) => ({
        open: without(state.open, diagramId),
        closed: { ...state.closed, [diagramId]: keptFor(state, proposal) },
      }));
    }
    return proposal;
  };
}

function openActions(
  set: SetReview,
  get: () => ReviewState,
): Pick<ReviewActions, 'openProposal' | 'setReview'> {
  return {
    openProposal: (proposal): void => {
      set((state) => ({
        live: without(state.live, proposal.diagramId),
        open: { ...state.open, [proposal.diagramId]: proposal },
      }));
    },
    setReview: (diagramId, { proposalId, review }): void => {
      const proposal: Proposal | undefined = get().open[diagramId];
      if (proposal?.id === proposalId) {
        set((state) => ({ open: { ...state.open, [diagramId]: { ...proposal, review } } }));
      }
    },
  };
}

function forgetAction(set: SetReview): ReviewActions['forget'] {
  return (diagramId: string): void => {
    set((state) => ({
      live: without(state.live, diagramId),
      open: without(state.open, diagramId),
      closed: without(state.closed, diagramId),
    }));
  };
}

/** Claude's changes waiting for review, and the code streaming in while review is on. */
export const useReviewStore: UseBoundStore<StoreApi<ReviewState>> = create<ReviewState>()(
  (set, get) => ({
    ...INITIAL_REVIEW,
    ...liveActions(set),
    ...openActions(set, get),
    closeProposal: closeAction(set, get),
    forget: forgetAction(set),
  }),
);

let lastProposalId: number = 0;

/** A fresh proposal id. */
export function nextProposalId(): number {
  lastProposalId += 1;
  return lastProposalId;
}

/** Nothing live, open or kept. For tests. */
export function resetReviewState(): void {
  useReviewStore.setState(INITIAL_REVIEW);
}

/** The number of changes a review counts. */
export function changeCount(review: ProposalReview): number {
  if (review.kind === 'code') {
    return review.changes;
  }
  const { added, changed, removed } = review.counts;
  return added + changed + removed;
}
