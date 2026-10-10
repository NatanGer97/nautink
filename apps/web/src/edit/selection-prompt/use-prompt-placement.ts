import { useEffect, useState } from 'react';

import { placePrompt, unionBox } from './prompt-placement.ts';

import type { Box, Placement, PlacementInput } from './prompt-placement.ts';
import type { SelectionPromptHandle } from './use-selection-prompt.ts';
import type { RefObject } from 'react';

/** Floating chrome the prompt keeps clear of: toolbar, inspector, library, zoom bar, prompt bar. */
export const CANVAS_CHROME_SELECTOR: string = '[data-canvas-chrome]';

function toBox(rect: DOMRect, origin: DOMRect): Box {
  return {
    left: rect.left - origin.left,
    top: rect.top - origin.top,
    right: rect.right - origin.left,
    bottom: rect.bottom - origin.top,
  };
}

function hasArea(rect: DOMRect): boolean {
  return rect.width > 0 || rect.height > 0;
}

function boxesOf(rects: readonly DOMRect[], origin: DOMRect): Box[] {
  return rects.filter(hasArea).map((rect) => toBox(rect, origin));
}

function chromeBoxes(origin: DOMRect): Box[] {
  const chrome: Element[] = [...document.querySelectorAll(CANVAS_CHROME_SELECTOR)];
  return boxesOf(
    chrome.map((element) => element.getBoundingClientRect()),
    origin,
  );
}

function round(at: Placement | null): Placement | null {
  return at === null ? null : { left: Math.round(at.left), top: Math.round(at.top) };
}

export interface PromptElements {
  /** The overlay over the whole canvas the prompt is placed in. */
  overlayRef: RefObject<HTMLElement | null>;
  promptRef: RefObject<HTMLElement | null>;
}

function placementInput(
  elements: PromptElements,
  handle: SelectionPromptHandle,
): PlacementInput | null {
  const origin: DOMRect | undefined = elements.overlayRef.current?.getBoundingClientRect();
  const prompt: HTMLElement | null = elements.promptRef.current;
  const target: Box | null =
    origin === undefined ? null : unionBox(boxesOf(handle.selectedRects(), origin));
  if (origin === undefined || prompt === null || target === null) {
    return null;
  }
  return {
    target,
    container: { width: origin.width, height: origin.height },
    prompt: { width: prompt.offsetWidth, height: prompt.offsetHeight },
    obstacles: chromeBoxes(origin),
    avoid: boxesOf(handle.otherRects(), origin),
  };
}

/** Where the prompt goes now, from the screen rectangles of the selection, the chrome and the shapes. */
export function measurePlacement(
  elements: PromptElements,
  handle: SelectionPromptHandle,
): Placement | null {
  const input: PlacementInput | null = placementInput(elements, handle);
  return input === null ? null : round(placePrompt(input));
}

function isSame(a: Placement | null, b: Placement | null): boolean {
  return a === b || (a !== null && b !== null && a.left === b.left && a.top === b.top);
}

/**
 * Follows the selection every frame while mounted: drags, pans, zooms and resizes all move it, in
 * every editor, without each one reporting them.
 */
export function usePromptPlacement(
  elements: PromptElements,
  handle: SelectionPromptHandle,
): Placement | null {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const { overlayRef, promptRef } = elements;
  useEffect(() => {
    let frame: number = 0;
    const tick = (): void => {
      const next: Placement | null = measurePlacement({ overlayRef, promptRef }, handle);
      setPlacement((previous) => (isSame(previous, next) ? previous : next));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return (): void => {
      cancelAnimationFrame(frame);
    };
  }, [overlayRef, promptRef, handle]);
  return placement;
}
