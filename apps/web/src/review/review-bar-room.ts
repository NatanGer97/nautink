import { useOpenProposal } from './use-review.ts';
import { useClaudeActivity } from '../chat/claude-activity.ts';
import { useViewedVersion } from '../history/viewed-version.ts';
import { useUiStore } from '../state/ui-store.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { ReviewBarProps } from './review-bar.tsx';
import type { Proposal } from './review-store.ts';
import type { DiagramView } from '@nautink/storage/records';

export type CanvasPlacement = Exclude<ReviewBarProps['placement'], 'drawer'>;

/** Below the visual editor's toolbar and read-only note in Edit and Split. */
export const CANVAS_PLACEMENTS: Readonly<Record<DiagramView, CanvasPlacement>> = {
  preview: 'canvas',
  edit: 'editor',
  split: 'split',
};

/**
 * Room the floating bar takes at the top of the canvas, by placement: its offset (`top-4`,
 * `top-16`, `top-26` in `review-bar.tsx`), its height (about 46 px) and a little air.
 */
export const REVIEW_BAR_ROOM_PX: Readonly<Record<CanvasPlacement, number>> = {
  canvas: 70,
  editor: 118,
  split: 158,
};

/** The open diagram's proposal bar over the canvas, and where; null while none shows there. */
export function useCanvasReviewBar(): { proposal: Proposal; placement: CanvasPlacement } | null {
  const diagramId: string | null = useWorkspaceStore((state) => state.activeId);
  const view: DiagramView | undefined = useWorkspaceStore(
    (state) => state.diagrams.find((item) => item.id === state.activeId)?.view,
  );
  const proposal: Proposal | undefined = useOpenProposal(diagramId ?? undefined);
  const isViewingVersion: boolean = useViewedVersion() !== null;
  const isCodeDrawerOpen: boolean = useUiStore((state) => state.isCodeDrawerOpen);
  const isInDrawer: boolean = proposal?.review?.kind === 'code' && isCodeDrawerOpen;
  if (proposal === undefined || isViewingVersion || isInDrawer) {
    return null;
  }
  return { proposal, placement: CANVAS_PLACEMENTS[view ?? 'preview'] };
}

/**
 * The top inset a fit should keep free: the room of the bar floating at the top of the canvas,
 * Claude's proposal bar or, while Claude works, the "Claude is editing" pill in the same place.
 */
export function useReviewBarRoom(): number {
  const placement: CanvasPlacement | undefined = useCanvasReviewBar()?.placement;
  const workingPlacement: CanvasPlacement | undefined = useWorkingPillPlacement();
  const shown: CanvasPlacement | undefined = placement ?? workingPlacement;
  return shown === undefined ? 0 : REVIEW_BAR_ROOM_PX[shown];
}

/** Where the "Claude is editing" pill floats, or undefined while it is hidden. */
function useWorkingPillPlacement(): CanvasPlacement | undefined {
  const diagramId: string | null = useWorkspaceStore((state) => state.activeId);
  const view: DiagramView | undefined = useWorkspaceStore(
    (state) => state.diagrams.find((item) => item.id === state.activeId)?.view,
  );
  const isWorking: boolean = useClaudeActivity(diagramId) !== null;
  const isViewingVersion: boolean = useViewedVersion() !== null;
  return isWorking && !isViewingVersion ? CANVAS_PLACEMENTS[view ?? 'preview'] : undefined;
}
