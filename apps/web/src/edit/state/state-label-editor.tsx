import { cn } from '@nautink/ui/lib/utils';
import { Handle, Position } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';

import { useStateEditorContext } from './state-context.ts';

import type { KeyboardEvent, ReactElement, RefObject } from 'react';

const SIDES: readonly (readonly [string, Position])[] = [
  ['t', Position.Top],
  ['r', Position.Right],
  ['b', Position.Bottom],
  ['l', Position.Left],
];

/** A dot on each side: drag from one to add a transition (transitions attach to facing sides). */
export function StateHandles({ isConnectable = true }: { isConnectable?: boolean }): ReactElement {
  return (
    <>
      {SIDES.map(([id, position]) => (
        <Handle
          key={id}
          id={id}
          type="source"
          position={position}
          isConnectable={isConnectable}
          className={cn(!isConnectable && 'invisible')}
        />
      ))}
    </>
  );
}

/** React Flow keeps a new node hidden until measured, so focus is retried for a moment. */
const FOCUS_RETRY_MS: number = 1500;

function useFocusWhenShown(ref: RefObject<HTMLTextAreaElement | null>): void {
  useEffect(() => {
    const until: number = performance.now() + FOCUS_RETRY_MS;
    let frame: number = 0;
    const tick = (): void => {
      const element: HTMLTextAreaElement | null = ref.current;
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

export interface LabelEditorProps {
  value: string;
  /** The text, or null when Esc cancelled. */
  onDone: (text: string | null) => void;
  /** Notes keep line breaks: Shift+Enter breaks a line. */
  isMultiline?: boolean;
  className?: string;
}

/** Inline editing (double-click or Enter): Enter saves, Esc cancels (v1's `LabelEditor`). */
export function LabelEditor({
  value,
  onDone,
  isMultiline = false,
  className,
}: LabelEditorProps): ReactElement {
  const [text, setText] = useState<string>(value);
  const ref: RefObject<HTMLTextAreaElement | null> = useRef<HTMLTextAreaElement>(null);
  useFocusWhenShown(ref);
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    event.stopPropagation();
    if (event.key === 'Enter' && !(isMultiline && event.shiftKey)) {
      event.preventDefault();
      onDone(text);
    } else if (event.key === 'Escape') {
      onDone(null);
    }
  };
  return (
    <textarea
      ref={ref}
      aria-label={isMultiline ? 'Note text' : 'State name'}
      value={text}
      rows={Math.max(1, text.split('\n').length)}
      className={cn(
        'nodrag nopan nowheel relative z-10 resize-none rounded-control border border-ring bg-panel px-1 text-sm outline-none',
        className,
      )}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onBlur={() => {
        onDone(text);
      }}
      onKeyDown={onKeyDown}
    />
  );
}

/** Whether this node is being renamed, and what ends the editing (v1's `useEditing`). */
export function useInlineEdit(id: string): [boolean, (text: string | null) => void] {
  const { editingId, setEditingId, rename, isReadOnly } = useStateEditorContext();
  const isEditing: boolean = editingId === id && !isReadOnly;
  const done = (text: string | null): void => {
    setEditingId(null);
    if (text !== null) {
      rename(id, text);
    }
  };
  return [isEditing, done];
}
