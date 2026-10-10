import { ReviewBar } from './review-bar.tsx';
import { useReviewKeys } from './use-review-keys.ts';
import { useOpenProposal } from './use-review.ts';
import { useViewedVersion } from '../history/viewed-version.ts';
import { useUiStore } from '../state/ui-store.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { ReviewBarProps } from './review-bar.tsx';
import type { Proposal } from './review-store.ts';
import type { DiagramView } from '@nautink/storage/records';
import type { ReactElement } from 'react';

/** Below the visual editor's toolbar and read-only note in Edit and Split. */
const PLACEMENTS: Readonly<Record<DiagramView, ReviewBarProps['placement']>> = {
  preview: 'canvas',
  edit: 'editor',
  split: 'split',
};

/**
 * The open diagram's proposal bar over the canvas, in every view (PRD §4.2), and Enter / Esc. A
 * viewed version hides it; a code diff shows its bar in the code drawer while that is open.
 */
export function CanvasReview(): ReactElement | null {
  const diagramId: string | null = useWorkspaceStore((state) => state.activeId);
  const view: DiagramView | undefined = useWorkspaceStore(
    (state) => state.diagrams.find((item) => item.id === state.activeId)?.view,
  );
  const proposal: Proposal | undefined = useOpenProposal(diagramId ?? undefined);
  const isViewingVersion: boolean = useViewedVersion() !== null;
  const isCodeDrawerOpen: boolean = useUiStore((state) => state.isCodeDrawerOpen);
  useReviewKeys(diagramId ?? undefined);
  const isInDrawer: boolean = proposal?.review?.kind === 'code' && isCodeDrawerOpen;
  if (proposal === undefined || isViewingVersion || isInDrawer) {
    return null;
  }
  return <ReviewBar proposal={proposal} placement={PLACEMENTS[view ?? 'preview']} />;
}
