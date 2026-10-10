import { Button } from '@nautink/ui/components/button';
import { cn } from '@nautink/ui/lib/utils';

import { acceptProposal, rejectProposal } from './review-actions.ts';
import { changeCount } from './review-store.ts';
import { OUTLINE_BUTTON_CLASS } from '../shell/button-styles.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { Proposal, ProposalReview } from './review-store.ts';
import type { ReviewCounts } from '@nautink/editors/review/review-element';
import type { ReactElement } from 'react';

/** "Claude proposes 5 changes" (M2), or what is happening while the comparison runs. */
export function proposalTitle(review: ProposalReview | null): string {
  if (review === null) {
    return "Comparing Claude's change…";
  }
  const count: number = changeCount(review);
  return `Claude proposes ${String(count)} ${count === 1 ? 'change' : 'changes'}`;
}

const LEGEND: readonly { mark: keyof ReviewCounts; label: string; swatch: string }[] = [
  {
    mark: 'added',
    label: 'Added',
    swatch: 'size-2.5 rounded-[3px] border-[1.5px] border-dashed border-success',
  },
  {
    mark: 'changed',
    label: 'Changed',
    swatch: 'size-2.5 rounded-[3px] border-[1.5px] border-accent-ink',
  },
  { mark: 'removed', label: 'Removed', swatch: 'h-0.5 w-2.5 bg-destructive' },
];

/** The marks' legend, with how many of each the proposal has. */
function Legend({ counts }: { counts: ReviewCounts }): ReactElement {
  return (
    <span className="inline-flex items-center gap-2.5 text-xs text-muted-foreground @max-2xl:hidden">
      {LEGEND.map(({ mark, label, swatch }) => (
        <span key={mark} className="inline-flex items-center gap-[5px]">
          <span aria-hidden="true" className={swatch} />
          {`${label} ${String(counts[mark])}`}
        </span>
      ))}
    </span>
  );
}

function ShowDiffButton(): ReactElement {
  return (
    <Button
      variant="outline"
      size="sm"
      className={OUTLINE_BUTTON_CLASS}
      onClick={() => {
        useUiStore.getState().setCodeDrawerOpen(true);
      }}
    >
      Show diff
    </Button>
  );
}

export interface ReviewBarProps {
  proposal: Proposal;
  /**
   * Floating over the canvas (M2), lower down below a visual editor's toolbar and read-only note
   * (Edit, Split), or at the top of the code drawer for a code diff.
   */
  placement: 'canvas' | 'editor' | 'split' | 'drawer';
}

const FLOATING: string =
  'absolute left-1/2 z-10 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-float border border-input bg-panel py-1.5 pr-1.5 pl-3.5 shadow-menu';

/** Shared with the "Claude is editing" pill, which sits where this bar will appear. */
export const PLACEMENT_CLASSES: Readonly<Record<ReviewBarProps['placement'], string>> = {
  canvas: `${FLOATING} top-4`,
  editor: `${FLOATING} top-16`,
  split: `${FLOATING} top-26`,
  drawer: 'shrink-0 border-b border-border-subtle py-1.5 pr-2 pl-3.5',
};

/** "Claude proposes N changes" with the legend, Reject and Accept ⏎ (PRD §4.2, M2). */
export function ReviewBar({ proposal, placement }: ReviewBarProps): ReactElement {
  const { review, diagramId } = proposal;
  const isCodeOnCanvas: boolean = placement !== 'drawer' && review?.kind === 'code';
  return (
    <section
      aria-label="Claude's proposal"
      className={cn('flex items-center gap-3.5 whitespace-nowrap', PLACEMENT_CLASSES[placement])}
    >
      <p className="shrink-0 font-medium">{proposalTitle(review)}</p>
      {review?.kind === 'structural' ? <Legend counts={review.counts} /> : null}
      <span className="ml-auto flex gap-1.5">
        {isCodeOnCanvas ? <ShowDiffButton /> : null}
        <Button
          variant="outline"
          size="sm"
          className={OUTLINE_BUTTON_CLASS}
          onClick={() => {
            rejectProposal(diagramId);
          }}
        >
          Reject
        </Button>
        <Button size="sm" onClick={() => void acceptProposal(diagramId)}>
          Accept
          <kbd aria-hidden="true" className="font-mono text-2xs opacity-60">
            ⏎
          </kbd>
        </Button>
      </span>
    </section>
  );
}
