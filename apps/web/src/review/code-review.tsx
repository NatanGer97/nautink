import { Suspense, lazy } from 'react';

import { ReviewBar } from './review-bar.tsx';

import type { ProposalDiffProps } from './proposal-diff.tsx';
import type { Proposal } from './review-store.ts';
import type { ComponentType, ReactElement } from 'react';

/** The diff editor loads with Monaco, the first time a proposal is open in the drawer (PRD §9). */
const LazyProposalDiff: ComponentType<ProposalDiffProps> = lazy(async () => ({
  default: (await import('./proposal-diff.tsx')).ProposalDiff,
}));

/**
 * The code drawer while a proposal is open: the code diff, read-only. A code-only review (types
 * without a visual editor, code that does not parse) has its bar here (PRD §4.2).
 */
export function CodeReview({ proposal }: { proposal: Proposal }): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {proposal.review?.kind === 'code' ? (
        <ReviewBar proposal={proposal} placement="drawer" />
      ) : (
        <p
          role="status"
          className="shrink-0 border-b border-border-subtle bg-subtle px-3.5 py-1.5 text-xs text-muted-foreground"
        >
          Claude&apos;s proposal · accept or reject it on the canvas
        </p>
      )}
      <Suspense fallback={<p className="px-3.5 py-2.5 text-muted-foreground">Loading the diff…</p>}>
        <LazyProposalDiff before={proposal.before} after={proposal.after} />
      </Suspense>
    </div>
  );
}
