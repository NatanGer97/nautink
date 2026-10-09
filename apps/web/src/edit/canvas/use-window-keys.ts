import { useEffect, useEffectEvent } from 'react';

import type { RefObject } from 'react';

/** Fields own their keys: typing in a label, the inspector, chat or the code never reaches the canvas. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/** The canvas owns the keyboard when nothing else has focus, or focus is inside it. */
export function isCanvasFocus(root: HTMLElement | null, active: Element | null): boolean {
  return active === null || active === document.body || root?.contains(active) === true;
}

/**
 * Canvas shortcuts on the window (React Flow's pan handler keeps focus off the canvas, as in v1).
 * `handle` returns true when it used the key. ⌘Z / ⌘⇧Z / ⌘Y are the app's: editors never bind them.
 */
export function useWindowKeys(
  root: RefObject<HTMLElement | null>,
  handle: (event: KeyboardEvent) => boolean,
): void {
  const onKey: (event: KeyboardEvent) => void = useEffectEvent((event: KeyboardEvent): void => {
    const isOurs: boolean =
      !event.defaultPrevented &&
      !isTypingTarget(event.target) &&
      isCanvasFocus(root.current, document.activeElement);
    if (isOurs && handle(event)) {
      event.preventDefault();
    }
  });
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return (): void => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}
