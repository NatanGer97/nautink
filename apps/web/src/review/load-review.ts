import type { ProposalReview } from './review-store.ts';

/** Fallback when the comparison itself fails: the proposal is still shown, as a code diff. */
function failedReview(err: unknown): ProposalReview {
  const reason: string = err instanceof Error ? err.message : String(err);
  return { kind: 'code', reason: `Could not compare the diagrams. ${reason}`, changes: 1 };
}

/**
 * Compares Claude's proposal with the code before the turn. The comparison and every editor's
 * parser load on first use, so they stay out of the main bundle (PRD §9).
 */
export async function loadReview(before: string, after: string): Promise<ProposalReview> {
  try {
    return await (await import('./compute-review.ts')).computeReview(before, after);
  } catch (err) {
    return failedReview(err);
  }
}
