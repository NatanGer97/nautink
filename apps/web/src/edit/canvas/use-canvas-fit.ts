import { useNodesInitialized, useReactFlow, useStore } from '@xyflow/react';
import { useEffect, useEffectEvent, useState } from 'react';

import { useWhenGrows } from '../../lib/use-when-grows.ts';
import { useFitInsets } from '../../shell/use-fit-insets.ts';

import type { FitInsets } from '../../lib/fit-insets.ts';
import type { FitViewOptions, ReactFlowInstance } from '@xyflow/react';

const FIT_PADDING_PX: number = 24;
const FIT_DURATION_MS: number = 250;
/** v1 never fitted past 120 %: a two-node diagram should not fill the screen. */
const FIT_MAX_ZOOM: number = 1.2;

type Pixels = `${number}px`;

function isPixels(text: string): text is Pixels {
  return /^-?\d+(\.\d+)?px$/.test(text);
}

/** React Flow reads a bare number as a share of the viewport, so pixel padding is spelled out. */
export function pixels(value: number): Pixels {
  const text: string = `${String(value)}px`;
  if (!isPixels(text)) {
    throw new Error(`Cannot use ${text} as a pixel padding.`);
  }
  return text;
}

/** v1's fit, keeping the proposal bar's room free at the top and the prompt bar's at the bottom. */
export function fitOptions(insets: FitInsets, duration: number = FIT_DURATION_MS): FitViewOptions {
  const side: Pixels = pixels(FIT_PADDING_PX);
  return {
    padding: {
      top: pixels(FIT_PADDING_PX + insets.top),
      left: side,
      right: side,
      bottom: pixels(FIT_PADDING_PX + insets.bottom),
    },
    maxZoom: FIT_MAX_ZOOM,
    duration,
  };
}

/** Fits the canvas now, around the floating bars. */
export function useFitNow(): (duration?: number) => void {
  const flow: ReactFlowInstance = useReactFlow();
  const insets: FitInsets = useFitInsets();
  return (duration?: number): void => {
    void flow.fitView(fitOptions(insets, duration));
  };
}

/**
 * Fits whenever `fitRequest` grows (first open, a full layout, Auto layout), once React Flow has
 * measured every node: a fit before that has no sizes to fit and leaves the view where it was.
 * The first fit is instant. Opening or closing chat later does not move the view. Returns true
 * once the first fit ran, or while there is nothing to fit, so the canvas can stay hidden until
 * the diagram is where it belongs.
 */
export function useFitOnRequest(fitRequest: number): boolean {
  const fitNow: (duration?: number) => void = useFitNow();
  const isMeasured: boolean = useNodesInitialized();
  const [fittedRequest, setFittedRequest] = useState<number>(0);
  const isDue: boolean = fitRequest > fittedRequest && isMeasured;
  const fit: () => void = useEffectEvent((): void => {
    fitNow(fittedRequest === 0 ? 0 : undefined);
    setFittedRequest(fitRequest);
  });
  useEffect(() => (isDue ? onNextFrame(fit) : undefined), [isDue]);
  const isEmpty: boolean = useStore((state) => state.nodes.length === 0);
  return fitRequest === 0 || fittedRequest > 0 || isEmpty;
}

/** Runs `run` on the next frame; the returned function cancels it. */
function onNextFrame(run: () => void): () => void {
  const frame: number = requestAnimationFrame(() => {
    run();
  });
  return (): void => {
    cancelAnimationFrame(frame);
  };
}

/**
 * Refits once when a bar appears at the top of the canvas (Claude's "editing" pill, then its
 * proposal bar), so the bar never covers the diagram. The canvas is read-only then.
 */
export function useFitWhenTopBarAppears(): void {
  const insets: FitInsets = useFitInsets();
  const fitNow: (duration?: number) => void = useFitNow();
  useWhenGrows(insets.top, () => {
    fitNow();
  });
}
