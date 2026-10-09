import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

import { ViewController } from './view-controller.ts';
import { viewBoxSize } from './view-math.ts';

import type { Point, Size, ViewTransform } from './view-math.ts';
import type { PointerEvent, RefObject } from 'react';

export interface PanZoomOptions {
  /** The rendered SVG markup; a new one is sized and, while following, fitted. */
  svg: string;
  /** A different key (another diagram) starts fitted again. */
  fitKey: string;
  /** A click (not a drag) on something inside the diagram. */
  onShapeClick?: (target: Element) => void;
}

export interface PointerHandlers {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
}

export interface PanZoom {
  viewportRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  view: ViewTransform;
  controller: ViewController;
  handlers: PointerHandlers;
}

/** The SVG's own size: its view box, or its box on the page when it has none. */
export function naturalSize(svg: SVGSVGElement): Size {
  const box: Size = viewBoxSize(svg.getAttribute('viewBox'));
  if (box.width > 0) {
    return box;
  }
  const rect: DOMRect = svg.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function pointIn(element: HTMLElement, event: { clientX: number; clientY: number }): Point {
  const rect: DOMRect = element.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/** Mermaid caps the SVG at its container's width; the canvas shows it at its natural size. */
function useContentSize(
  stageRef: PanZoom['stageRef'],
  svg: string,
  controller: ViewController,
): void {
  useLayoutEffect(() => {
    const element: SVGSVGElement | null = stageRef.current?.querySelector('svg') ?? null;
    if (element === null) {
      return;
    }
    const size: Size = naturalSize(element);
    element.style.maxWidth = 'none';
    element.setAttribute('width', String(size.width));
    element.setAttribute('height', String(size.height));
    controller.setContent(size);
  }, [stageRef, svg, controller]);
}

function useViewportSize(viewportRef: PanZoom['viewportRef'], controller: ViewController): void {
  useEffect(() => {
    const viewport: HTMLDivElement | null = viewportRef.current;
    if (viewport === null) {
      return undefined;
    }
    const measure = (): void => {
      controller.setViewport({ width: viewport.clientWidth, height: viewport.clientHeight });
    };
    measure();
    const observer: ResizeObserver = new ResizeObserver(measure);
    observer.observe(viewport);
    return (): void => {
      observer.disconnect();
    };
  }, [viewportRef, controller]);
}

function wheelListener(
  viewport: HTMLElement,
  controller: ViewController,
): (event: WheelEvent) => void {
  return (event: WheelEvent): void => {
    event.preventDefault();
    const { deltaX, deltaY } = event;
    const isZoom: boolean = event.ctrlKey || event.metaKey;
    controller.wheel({ at: pointIn(viewport, event), deltaX, deltaY, isZoom });
  };
}

/** The wheel listener is added by hand: React's is passive, so it could not stop the page scroll. */
function useWheel(viewportRef: PanZoom['viewportRef'], controller: ViewController): void {
  useEffect(() => {
    const viewport: HTMLDivElement | null = viewportRef.current;
    if (viewport === null) {
      return undefined;
    }
    const onWheel: (event: WheelEvent) => void = wheelListener(viewport, controller);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return (): void => {
      viewport.removeEventListener('wheel', onWheel);
    };
  }, [viewportRef, controller]);
}

/** The attribute on the element that holds the rendered SVG. */
export const STAGE_ATTRIBUTE: string = 'data-preview-stage';

/** The pressed element when it is part of the diagram, else null (a press on empty canvas). */
function pressedShape(pressed: EventTarget | null): Element | null {
  const isShape: boolean =
    pressed instanceof Element && pressed.closest(`[${STAGE_ATTRIBUTE}]`) !== null;
  return isShape && pressed instanceof Element ? pressed : null;
}

function startPress(controller: ViewController, event: PointerEvent<HTMLDivElement>): void {
  if (event.button === 0) {
    controller.pointerDown({ x: event.clientX, y: event.clientY }, event.target);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
}

/** Drag pans; a press that does not move is a click on whatever shape is under it. */
function pointerHandlers(
  controller: ViewController,
  onShapeClick: PanZoomOptions['onShapeClick'],
): PointerHandlers {
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>): void => {
      startPress(controller, event);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>): void => {
      controller.pointerMove({ x: event.clientX, y: event.clientY });
    },
    onPointerUp: (): void => {
      const shape: Element | null = pressedShape(controller.pointerUp());
      if (shape !== null) {
        onShapeClick?.(shape);
      }
    },
  };
}

/** Pan, zoom and fit for the preview canvas. */
export function usePanZoom({ svg, fitKey, onShapeClick }: PanZoomOptions): PanZoom {
  const viewportRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null);
  const stageRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null);
  const [controller] = useState<ViewController>(() => new ViewController());
  const view: ViewTransform = useSyncExternalStore(controller.subscribe, controller.getView);
  useLayoutEffect(() => {
    controller.follow();
  }, [controller, fitKey]);
  useContentSize(stageRef, svg, controller);
  useViewportSize(viewportRef, controller);
  useWheel(viewportRef, controller);
  const handlers: PointerHandlers = pointerHandlers(controller, onShapeClick);
  return { viewportRef, stageRef, view, controller, handlers };
}
