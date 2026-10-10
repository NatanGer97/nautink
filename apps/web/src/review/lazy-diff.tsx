import { Suspense, lazy } from 'react';

import type { ProposalDiffProps } from './proposal-diff.tsx';
import type { ComponentType, ReactElement } from 'react';

/** The diff editor loads with Monaco, the first time a diff is shown in the drawer (PRD §9). */
const LazyProposalDiff: ComponentType<ProposalDiffProps> = lazy(async () => ({
  default: (await import('./proposal-diff.tsx')).ProposalDiff,
}));

/** Monaco's read-only diff of `before` → `after`, loaded on demand. */
export function LazyDiff(props: ProposalDiffProps): ReactElement {
  return (
    <Suspense fallback={<p className="px-3.5 py-2.5 text-muted-foreground">Loading the diff…</p>}>
      <LazyProposalDiff {...props} />
    </Suspense>
  );
}
