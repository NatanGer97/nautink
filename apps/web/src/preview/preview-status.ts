import { create } from 'zustand';

import type { MermaidError } from '../mermaid/validate.ts';
import type { StoreApi, UseBoundStore } from 'zustand';

/** `empty` is a diagram with no code yet. */
export type PreviewValidity = 'valid' | 'invalid' | 'empty';

/** What the preview knows about the open diagram's render. */
export interface PreviewStatus {
  /** The diagram these values belong to; `null` before the first report. */
  diagramId: string | null;
  validity: PreviewValidity;
  /** The parse or render error while `validity` is `invalid`. */
  error: MermaidError | null;
  /** How long the last good render took; `null` until one finished. */
  renderMs: number | null;
  /** The last good SVG of this diagram, kept while the code does not parse. Empty when none. */
  svg: string;
}

/** One thing the renderer reports. */
export type PreviewEvent =
  | { kind: 'rendered'; diagramId: string; svg: string; renderMs: number }
  | { kind: 'failed'; diagramId: string; error: MermaidError }
  | { kind: 'empty'; diagramId: string };

export const INITIAL_PREVIEW_STATUS: PreviewStatus = {
  diagramId: null,
  validity: 'empty',
  error: null,
  renderMs: null,
  svg: '',
};

/** The status after `event`. A failure keeps the last good SVG only when it is the same diagram. */
export function nextPreviewStatus(status: PreviewStatus, event: PreviewEvent): PreviewStatus {
  if (event.kind === 'rendered') {
    const { diagramId, svg, renderMs } = event;
    return { diagramId, validity: 'valid', error: null, renderMs, svg };
  }
  if (event.kind === 'empty') {
    return { ...INITIAL_PREVIEW_STATUS, diagramId: event.diagramId };
  }
  const isSameDiagram: boolean = status.diagramId === event.diagramId;
  return {
    diagramId: event.diagramId,
    validity: 'invalid',
    error: event.error,
    renderMs: isSameDiagram ? status.renderMs : null,
    svg: isSameDiagram ? status.svg : '',
  };
}

export interface PreviewStatusState extends PreviewStatus {
  report: (event: PreviewEvent) => void;
  reset: () => void;
}

/** The preview's status, written by the preview canvas and read by the status bar, export, code. */
export const usePreviewStatusStore: UseBoundStore<StoreApi<PreviewStatusState>> =
  create<PreviewStatusState>()((set) => ({
    ...INITIAL_PREVIEW_STATUS,
    report: (event: PreviewEvent): void => {
      set((state) => nextPreviewStatus(state, event));
    },
    reset: (): void => {
      set(INITIAL_PREVIEW_STATUS);
    },
  }));

/** The preview's status for the open diagram: validity, error, render time and the last good SVG. */
export function usePreviewStatus(): PreviewStatus {
  const diagramId: string | null = usePreviewStatusStore((state) => state.diagramId);
  const validity: PreviewValidity = usePreviewStatusStore((state) => state.validity);
  const error: MermaidError | null = usePreviewStatusStore((state) => state.error);
  const renderMs: number | null = usePreviewStatusStore((state) => state.renderMs);
  const svg: string = usePreviewStatusStore((state) => state.svg);
  return { diagramId, validity, error, renderMs, svg };
}
