import { cn } from '@nautink/ui/lib/utils';
import { useEffect, useRef } from 'react';

import type { KeyboardEvent, ReactElement, RefObject } from 'react';

export interface InlineRenameInputProps {
  initialValue: string;
  /** The input's accessible name. */
  label: string;
  /** Called with the trimmed title when it is not blank and differs from the start. */
  onCommit: (title: string) => void;
  /** Called when the edit ends without a change (Escape, blank, unchanged). */
  onCancel: () => void;
  className?: string;
}

/** A title field that commits on Enter or blur and cancels on Escape (rows, top bar). */
export function InlineRenameInput({
  initialValue,
  label,
  onCommit,
  onCancel,
  className,
}: InlineRenameInputProps): ReactElement {
  const inputRef: RefObject<HTMLInputElement | null> = useRef<HTMLInputElement>(null);
  const isDoneRef: RefObject<boolean> = useRef<boolean>(false);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const finish = (value: string | null): void => {
    if (isDoneRef.current) {
      return;
    }
    isDoneRef.current = true;
    const title: string = value?.trim() ?? '';
    if (value === null || title === '' || title === initialValue) {
      onCancel();
      return;
    }
    onCommit(title);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    event.stopPropagation();
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      finish(event.key === 'Enter' ? event.currentTarget.value : null);
    }
  };
  return (
    <input
      ref={inputRef}
      aria-label={label}
      defaultValue={initialValue}
      className={cn(
        'h-7 min-w-0 rounded-control border border-ring bg-panel px-1.5 font-medium outline-none',
        className,
      )}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        finish(event.currentTarget.value);
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    />
  );
}
