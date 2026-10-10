import { cn } from '@nautink/ui/lib/utils';
import { useEffect, useRef, useState } from 'react';

import type { KeyboardEvent, ReactElement, RefObject } from 'react';

/** React Flow keeps a new node hidden until measured, so focus is retried for a moment. */
const FOCUS_RETRY_MS: number = 1500;

type EditorElement = HTMLInputElement | HTMLTextAreaElement;

function useFocusWhenShown(ref: RefObject<EditorElement | null>): void {
  useEffect(() => {
    const until: number = performance.now() + FOCUS_RETRY_MS;
    let frame: number = 0;
    const tick = (): void => {
      const element: EditorElement | null = ref.current;
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

export interface InlineEditorProps {
  /** The accessible name ("Class name", "Attribute"). */
  label: string;
  value: string;
  /** The new text, or null when Esc cancelled. Called once. */
  onDone: (text: string | null) => void;
  isMultiline?: boolean;
  className?: string;
}

const MIN_NOTE_ROWS: number = 2;

/** What the input and the textarea share. */
interface EditorControl {
  value: string;
  className: string;
  onChange: (event: { target: { value: string } }) => void;
  onBlur: () => void;
  onDoubleClick: (event: { stopPropagation: () => void }) => void;
  onKeyDown: (event: KeyboardEvent<EditorElement>) => void;
}

function keyHandler(
  finish: (result: string | null) => void,
  text: string,
): (event: KeyboardEvent<EditorElement>) => void {
  return (event: KeyboardEvent<EditorElement>): void => {
    event.stopPropagation();
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      finish(text);
    } else if (event.key === 'Escape') {
      finish(null);
    }
  };
}

function useInlineControl({ value, onDone, className }: InlineEditorProps): EditorControl {
  const [text, setText] = useState<string>(value);
  // Enter saves and then the input unmounts, which can blur it: report once.
  const doneRef: RefObject<boolean> = useRef<boolean>(false);
  const finish = (result: string | null): void => {
    if (!doneRef.current) {
      doneRef.current = true;
      onDone(result);
    }
  };
  return {
    value: text,
    className: cn(
      'nodrag nopan nowheel relative z-10 w-full min-w-0 rounded-xs border border-ring bg-panel px-1 text-foreground outline-none',
      className,
    ),
    onChange: (event): void => {
      setText(event.target.value);
    },
    onBlur: (): void => {
      finish(text);
    },
    onDoubleClick: (event): void => {
      event.stopPropagation();
    },
    onKeyDown: (event): void => {
      keyHandler(finish, text)(event);
    },
  };
}

/** In-place text editing on the canvas: Enter saves (Shift+Enter breaks a note's line), Esc cancels. */
export function InlineEditor(props: InlineEditorProps): ReactElement {
  const isMultiline: boolean = props.isMultiline === true;
  const inputRef: RefObject<HTMLInputElement | null> = useRef<HTMLInputElement>(null);
  const areaRef: RefObject<HTMLTextAreaElement | null> = useRef<HTMLTextAreaElement>(null);
  useFocusWhenShown(isMultiline ? areaRef : inputRef);
  const control: EditorControl = useInlineControl(props);
  return isMultiline ? (
    <textarea
      ref={areaRef}
      aria-label={props.label}
      rows={Math.max(MIN_NOTE_ROWS, control.value.split('\n').length)}
      {...control}
    />
  ) : (
    <input ref={inputRef} aria-label={props.label} {...control} />
  );
}
