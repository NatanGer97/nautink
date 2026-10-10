import { usePromptBarInset } from './prompt-bar-inset.ts';
import { useReviewBarRoom } from '../review/review-bar-room.ts';

import type { FitInsets } from '../lib/fit-insets.ts';

/**
 * What every fit (Preview and the visual editors) keeps free: the proposal bar's room at the top
 * while Claude's proposal floats over the canvas, and the prompt bar's room at the bottom.
 */
export function useFitInsets(): FitInsets {
  const top: number = useReviewBarRoom();
  const bottom: number = usePromptBarInset();
  return { top, bottom };
}
