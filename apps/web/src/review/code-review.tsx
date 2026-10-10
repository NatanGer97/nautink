import { LazyDiff } from './lazy-diff.tsx';
import { ReviewBar } from './review-bar.tsx';
import { agentName } from '../chat/agent-name.ts';

import type { Proposal } from './review-store.ts';
import type { ReactElement } from 'react';

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
          {agentName(proposal.agent)}&apos;s proposal · accept or reject it on the canvas
        </p>
      )}
      <LazyDiff before={proposal.before} after={proposal.after} />
    </div>
  );
}
