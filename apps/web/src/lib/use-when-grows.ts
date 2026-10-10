import { useEffect, useEffectEvent, useRef } from 'react';

import type { RefObject } from 'react';

/**
 * Runs `onGrow` a frame after `value` becomes larger than it was, for example when a bar appears
 * at the top of the canvas and the view should refit around it. Never on the first render.
 */
export function useWhenGrows(value: number, onGrow: () => void): void {
  const previous: RefObject<number> = useRef<number>(value);
  const grow: () => void = useEffectEvent(onGrow);
  useEffect(() => {
    const isLarger: boolean = value > previous.current;
    previous.current = value;
    if (!isLarger) {
      return undefined;
    }
    const frame: number = requestAnimationFrame(() => {
      grow();
    });
    return (): void => {
      cancelAnimationFrame(frame);
    };
  }, [value]);
}
