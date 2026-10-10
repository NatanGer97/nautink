import { useReviewStore } from './review-store.ts';

import type { Proposal, ProposalReview, ReviewData } from './review-store.ts';
import type { StructuralReview } from '@nautink/editors/review/review-diagram';
import type { Diagram } from '@nautink/storage/records';

/** Shown on the canvas and in the code drawer while a proposal waits for review. */
export const REVIEWING: string =
  "Reviewing Claude's change · read-only until you accept or reject it";

/** Shown while Claude writes a proposal into a diagram (review on). */
export const CLAUDE_PROPOSING: string =
  'Claude is writing a change for you to review. Editing is paused until you accept or reject it.';

/** The code the canvas shows for a diagram: the live build, the open proposal, or its own code. */
export function shownCode(diagram: Pick<Diagram, 'id' | 'code'>, review: ReviewData): string {
  const live: string | undefined = review.live[diagram.id]?.code;
  if (live !== undefined) {
    return live;
  }
  const proposal: Proposal | undefined = review.open[diagram.id];
  if (proposal === undefined) {
    return diagram.code;
  }
  return proposal.review?.kind === 'structural' ? proposal.review.code : proposal.after;
}

/** `shownCode` for a diagram, kept in step with the review store. */
export function useShownCode(diagram: Pick<Diagram, 'id' | 'code'>): string {
  return useReviewStore((state) => shownCode(diagram, state));
}

/** The proposal waiting on a diagram, if any. */
export function useOpenProposal(diagramId: string | undefined): Proposal | undefined {
  return useReviewStore((state) => (diagramId === undefined ? undefined : state.open[diagramId]));
}

/** Why the canvas and code cannot be edited because of a review, or `null`. */
export function useReviewReadOnlyReason(diagramId: string | undefined): string | null {
  return useReviewStore((state) => {
    if (diagramId === undefined) {
      return null;
    }
    if (diagramId in state.open) {
      return REVIEWING;
    }
    return diagramId in state.live ? CLAUDE_PROPOSING : null;
  });
}

/** The open proposal's canvas review (what to show and mark), once compared; else `null`. */
export function useStructuralReview(diagramId: string | undefined): StructuralReview | null {
  return useReviewStore((state) => {
    const review: ProposalReview | null | undefined =
      diagramId === undefined ? undefined : state.open[diagramId]?.review;
    return review?.kind === 'structural' ? review : null;
  });
}

/** True while Claude writes into the diagram with review on, or its proposal waits. */
export function useIsReviewing(diagramId: string | undefined): boolean {
  return useReviewReadOnlyReason(diagramId) !== null;
}
