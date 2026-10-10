import { useReactFlow } from '@xyflow/react';
import { useEffect, useEffectEvent } from 'react';

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
 * Fits whenever `fitRequest` grows (first open, a full layout, Auto layout), a frame later so the
 * new nodes are on the canvas. Opening or closing chat later does not move the view.
 */
export function useFitOnRequest(fitRequest: number): void {
  const fitNow: (duration?: number) => void = useFitNow();
  const fit: () => void = useEffectEvent((): void => {
    fitNow();
  });
  useEffect(() => {
    if (fitRequest === 0) {
      return undefined;
    }
    const frame: number = requestAnimationFrame(() => {
      fit();
    });
    return (): void => {
      cancelAnimationFrame(frame);
    };
  }, [fitRequest]);
}
