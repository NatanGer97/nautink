import { cn } from '@nautink/ui/lib/utils';
import { useEffect, useRef, useState } from 'react';

import type { KeyboardEvent, ReactElement, RefObject } from 'react';

/** React Flow keeps a new node hidden until measured, so focus is retried for a moment. */
const FOCUS_RETRY_MS: number = 1500;
const MIN_SIZE: number = 4;

function useFocusWhenShown(ref: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    const until: number = performance.now() + FOCUS_RETRY_MS;
    let frame: number = 0;
    const tick = (): void => {
      const element: HTMLInputElement | null = ref.current;
      element?.focus();
      if (element !== null && document.activeElement === element) {
        element.select();
      } else if (performance.now() < until) {
        frame = requestAnimationFrame(tick);
      }
    };
    tick();
    return (): void => {
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}

export interface InlineInputProps {
  /** The accessible name ("Entity name", "Relationship label"). */
  label: string;
  value: string;
  /** The text on Enter or blur; null on Esc. Called once. */
  onDone: (text: string | null) => void;
  className?: string;
}

/** A one-line editor on the canvas (v1's `InlineInput`): Enter or blur saves, Esc cancels. */
export function InlineInput({ label, value, onDone, className }: InlineInputProps): ReactElement {
  const [text, setText] = useState<string>(value);
  const ref: RefObject<HTMLInputElement | null> = useRef<HTMLInputElement>(null);
  const isDone: RefObject<boolean> = useRef<boolean>(false);
  useFocusWhenShown(ref);
  const finish = (result: string | null): void => {
    if (!isDone.current) {
      isDone.current = true;
      onDone(result);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(text);
    } else if (event.key === 'Escape') {
      finish(null);
    }
  };
  return (
    <input
      ref={ref}
      aria-label={label}
      value={text}
      size={Math.max(MIN_SIZE, text.length + 1)}
      className={cn('nodrag nopan max-w-full rounded-xs bg-panel px-1 outline-none', className)}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onBlur={() => {
        finish(text);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
