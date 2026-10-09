import { useUiStore } from '../state/ui-store.ts';

/**
 * Room the floating prompt bar takes at the bottom of the canvas: its 20 px offset, its height and
 * a little air. A fitted diagram stays above it, so tall diagrams are not hidden under it.
 */
export const PROMPT_BAR_INSET_PX: number = 76;

/** True while the canvas shows the floating prompt bar (the chat panel is closed, M3/M7). */
export function useIsPromptBarShown(): boolean {
  return useUiStore((state) => state.activePanel !== 'chat');
}

/** The bottom inset a fit should keep free: the prompt bar's room, or 0 while chat is open. */
export function usePromptBarInset(): number {
  return useIsPromptBarShown() ? PROMPT_BAR_INSET_PX : 0;
}
