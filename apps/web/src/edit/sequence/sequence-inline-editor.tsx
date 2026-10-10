import { useLayoutEffect, useRef, useState } from 'react';

import { inlineField } from './sequence-text.ts';

import type { InlineField } from './sequence-text.ts';
import type { EditTarget } from './sequence-types.ts';
import type { SequenceLayout } from '@nautink/editors/sequence/layout';
import type { KeyboardEvent, ReactElement, RefObject } from 'react';

const FIELD_NAMES: Readonly<Record<EditTarget['kind'], string>> = {
  participant: 'Participant name',
  message: 'Message text',
  note: 'Note text',
  section: 'Block label',
};

interface InlineTextareaProps {
  field: InlineField;
  minX: number;
  label: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

/** The field itself: Enter or leaving it saves, Shift+Enter adds a line, Esc cancels (v1). */
function InlineTextarea({
  field,
  minX,
  label,
  onCommit,
  onCancel,
}: InlineTextareaProps): ReactElement {
  const ref: RefObject<HTMLTextAreaElement | null> = useRef<HTMLTextAreaElement>(null);
  const isDone: RefObject<boolean> = useRef<boolean>(false);
  const [text, setText] = useState<string>(field.value);
  useLayoutEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (isSaved: boolean): void => {
    if (!isDone.current) {
      isDone.current = true;
      if (isSaved) {
        onCommit(text);
      } else {
        onCancel();
      }
    }
  };
  return (
    <textarea
      ref={ref}
      aria-label={label}
      value={text}
      rows={Math.max(1, text.split('\n').length)}
      className="absolute z-10 resize-none overflow-hidden rounded-xs border-[1.5px] border-accent-ink bg-panel px-1 py-0.5 text-center text-[13px] leading-4 text-foreground shadow-float outline-none [font-family:system-ui,sans-serif]"
      style={{ left: field.x - minX, top: field.y, width: field.w }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onBlur={() => {
        finish(true);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
        event.stopPropagation();
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          finish(true);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        }
      }}
    />
  );
}

export interface InlineEditorProps {
  layout: SequenceLayout;
  target: EditTarget;
  onCommit: (target: EditTarget, text: string) => void;
  onCancel: () => void;
}

/** Text edited in place over the drawing (v1's `InlineEditor`), in canvas coordinates. */
export function InlineEditor({
  layout,
  target,
  onCommit,
  onCancel,
}: InlineEditorProps): ReactElement | null {
  const field: InlineField | null = inlineField(layout, target);
  if (field === null) {
    return null;
  }
  const key: string = `${target.kind}:${target.id}:${target.kind === 'section' ? String(target.sectionIndex) : ''}`;
  return (
    <InlineTextarea
      key={key}
      field={field}
      minX={layout.minX}
      label={FIELD_NAMES[target.kind]}
      onCommit={(text) => {
        onCommit(target, text);
      }}
      onCancel={onCancel}
    />
  );
}
