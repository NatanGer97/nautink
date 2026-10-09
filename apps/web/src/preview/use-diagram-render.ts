import { useEffect } from 'react';

import { usePreviewStatusStore } from './preview-status.ts';
import { renderDiagram } from './render-diagram.ts';

import type { PreviewEvent } from './preview-status.ts';
import type { RenderOutcome } from './render-diagram.ts';

/** Typing pauses this long before the preview renders (v1's debounce). */
export const RENDER_DELAY_MS: number = 250;

/** The status event for a finished render. */
export function renderEvent(diagramId: string, outcome: RenderOutcome): PreviewEvent {
  return outcome.kind === 'rendered'
    ? { kind: 'rendered', diagramId, svg: outcome.svg, renderMs: outcome.renderMs }
    : { kind: 'failed', diagramId, error: outcome.error };
}

export interface DiagramRenderInput {
  diagramId: string;
  code: string;
  isDark: boolean;
}

/** Renders after the delay and reports the result. Returns a cancel that also drops a late result. */
export function scheduleRender(
  { diagramId, code, isDark }: DiagramRenderInput,
  report: (event: PreviewEvent) => void,
): () => void {
  let isCurrent: boolean = true;
  const run = async (): Promise<void> => {
    const outcome: RenderOutcome = await renderDiagram({ code, isDark });
    if (isCurrent) {
      report(renderEvent(diagramId, outcome));
    }
  };
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    void run();
  }, RENDER_DELAY_MS);
  return (): void => {
    isCurrent = false;
    clearTimeout(timer);
  };
}

/**
 * Renders the open diagram a beat after its code (or the theme) changes, and reports the result to
 * the preview status. A render that finishes after a newer change is dropped.
 */
export function useDiagramRender({ diagramId, code, isDark }: DiagramRenderInput): void {
  const report: (event: PreviewEvent) => void = usePreviewStatusStore((state) => state.report);
  useEffect(() => {
    if (code.trim() === '') {
      report({ kind: 'empty', diagramId });
      return undefined;
    }
    return scheduleRender({ diagramId, code, isDark }, report);
  }, [diagramId, code, isDark, report]);
}
