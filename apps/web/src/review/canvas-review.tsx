import { useCanvasReviewBar } from './review-bar-room.ts';
import { ReviewBar } from './review-bar.tsx';
import { useReviewKeys } from './use-review-keys.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { ReactElement } from 'react';

/**
 * The open diagram's proposal bar over the canvas, in every view (PRD §4.2), and Enter / Esc. A
 * viewed version hides it; a code diff shows its bar in the code drawer while that is open.
 */
export function CanvasReview(): ReactElement | null {
  const diagramId: string | null = useWorkspaceStore((state) => state.activeId);
  const bar: ReturnType<typeof useCanvasReviewBar> = useCanvasReviewBar();
  useReviewKeys(diagramId ?? undefined);
  return bar === null ? null : <ReviewBar proposal={bar.proposal} placement={bar.placement} />;
}
