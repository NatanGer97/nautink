// Loaded on demand (`load-review.ts`): it pulls in every editor's parser.
import { reviewDiagram } from '@nautink/editors/review/review-diagram';

import { changeCount } from './review-store.ts';
import { loadMermaidDiagram } from '../edit/sync/mermaid-loader.ts';
import { diffLines } from '../history/line-diff.ts';

import type { ProposalReview } from './review-store.ts';
import type { DiffLine } from '../history/line-diff.ts';
import type { DiagramReview } from '@nautink/editors/review/review-diagram';
import type { DiagramLoader } from '@nautink/visual-core/editor-contract';

/** Blocks of consecutive added or removed lines. */
export function changedBlocks(lines: readonly DiffLine[]): number {
  return lines.filter(
    (line: DiffLine, index: number) =>
      line.kind !== 'same' && (index === 0 || lines[index - 1]?.kind === 'same'),
  ).length;
}

/** Shown when the code changed but the diagram did not (comments, order, spacing). */
export const TEXT_ONLY: string = 'Only the text of the code changed.';

/** Compares `after` with `before`: on the canvas when the type allows it, else as a code diff. */
export async function computeReview(
  before: string,
  after: string,
  load: DiagramLoader = loadMermaidDiagram,
): Promise<ProposalReview> {
  const review: DiagramReview = await reviewDiagram({ before, after, load });
  if (review.kind === 'structural' && changeCount(review) > 0) {
    return review;
  }
  const reason: string = review.kind === 'code' ? review.reason : TEXT_ONLY;
  return { kind: 'code', reason, changes: changedBlocks(diffLines(before, after)) };
}
