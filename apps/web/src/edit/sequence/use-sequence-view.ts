import { useEffect, useEffectEvent, useState } from 'react';

import {
  fitSequence,
  START_VIEW,
  toCanvasPoint,
  wheelFactor,
  zoomAround,
  zoomCentered,
} from './sequence-view.ts';
import { usePromptBarInset } from '../../shell/prompt-bar-inset.ts';

import type { CanvasBounds } from './sequence-view.ts';
import type { Point, Size, ViewTransform } from '../../preview/view-math.ts';
import type { Dispatch, SetStateAction } from 'react';

export interface SequenceView {
  /** The `ref` of the viewport element (a callback: the element is kept as state). */
  attachViewport: (element: HTMLDivElement | null) => void;
  view: ViewTransform;
  setView: Dispatch<SetStateAction<ViewTransform>>;
  /** Fits the whole diagram now, above the prompt bar. */
  fit: () => void;
  zoomBy: (factor: number) => void;
  /** A point on screen in canvas coordinates. */
  toCanvas: (client: Point) => Point;
}

const NO_BOUNDS: CanvasBounds = { minX: 0, width: 0, height: 0 };

function sizeOf(element: HTMLElement | null): Size {
  return { width: element?.clientWidth ?? 0, height: element?.clientHeight ?? 0 };
}

function pointIn(element: HTMLElement | null, client: Point): Point {
  const rect: DOMRect | undefined = element?.getBoundingClientRect();
  return { x: client.x - (rect?.left ?? 0), y: client.y - (rect?.top ?? 0) };
}

interface ViewInputs {
  viewport: HTMLDivElement | null;
  bounds: CanvasBounds | null;
  inset: number;
}

/** The view's commands, reading the viewport only when they run. */
function viewCommands(
  { viewport, bounds, inset }: ViewInputs,
  view: ViewTransform,
  setView: Dispatch<SetStateAction<ViewTransform>>,
): Omit<SequenceView, 'view' | 'setView' | 'attachViewport'> {
  return {
    fit: (): void => {
      setView(fitSequence(bounds ?? NO_BOUNDS, sizeOf(viewport), inset));
    },
    zoomBy: (factor: number): void => {
      const size: Size = sizeOf(viewport);
      setView((current) => zoomCentered(current, factor, size));
    },
    toCanvas: (client: Point): Point =>
      toCanvasPoint(pointIn(viewport, client), view, bounds?.minX ?? 0),
  };
}

/** React Flow's wheel: scrolling zooms around the pointer; the listener is not passive. */
function useWheelZoom(
  viewport: HTMLDivElement | null,
  setView: Dispatch<SetStateAction<ViewTransform>>,
): void {
  const onWheel: (event: WheelEvent) => void = useEffectEvent((event: WheelEvent): void => {
    event.preventDefault();
    const at: Point = pointIn(viewport, { x: event.clientX, y: event.clientY });
    setView((view) => zoomAround(view, wheelFactor(event.deltaY), at));
  });
  useEffect(() => {
    const listener = (event: WheelEvent): void => {
      onWheel(event);
    };
    viewport?.addEventListener('wheel', listener, { passive: false });
    return (): void => {
      viewport?.removeEventListener('wheel', listener);
    };
  }, [viewport]);
}

/** Fits a frame after each fit request (first open), once the drawing is on the page. */
function useFitOnRequest(fitRequest: number, fit: () => void): void {
  const onRequest: () => void = useEffectEvent(fit);
  useEffect(() => {
    if (fitRequest === 0) {
      return undefined;
    }
    const frame: number = requestAnimationFrame(() => {
      onRequest();
    });
    return (): void => {
      cancelAnimationFrame(frame);
    };
  }, [fitRequest]);
}

/**
 * Pan, zoom and fit for the sequence canvas, without React Flow: the drawing is one SVG laid out
 * from the model, so the view is a CSS transform of the stage that holds it.
 */
export function useSequenceView(bounds: CanvasBounds | null, fitRequest: number): SequenceView {
  const [viewport, attachViewport] = useState<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewTransform>(START_VIEW);
  const inset: number = usePromptBarInset();
  const commands: Omit<SequenceView, 'view' | 'setView' | 'attachViewport'> = viewCommands(
    { viewport, bounds, inset },
    view,
    setView,
  );
  useWheelZoom(viewport, setView);
  useFitOnRequest(fitRequest, commands.fit);
  return { attachViewport, view, setView, ...commands };
}
