import { IconButton } from '@nautink/ui/icon-button';
import { cn } from '@nautink/ui/lib/utils';
import { SquareDashed } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { usePromptPlacement } from './use-prompt-placement.ts';
import { useSelectionPromptStore } from './use-selection-prompt.ts';
import { toChatSelection } from '../../chat/chat-selection.ts';
import { useChatStore } from '../../chat/chat-store.ts';
import { SendButton } from '../../chat/send-button.tsx';
import { canSendChat, sendChat } from '../../chat/send-chat.ts';
import { useCanvasSelectionStore } from '../selection/canvas-selection.ts';

import type { Placement } from './prompt-placement.ts';
import type { SelectionPromptHandle } from './use-selection-prompt.ts';
import type { SelectedItem } from '../selection/canvas-selection.ts';
import type { KeyboardEvent, ReactElement, RefObject } from 'react';

/** "Ask Claude about these 2…", or "Ask Claude about this node…" for one item. */
export function promptPlaceholder(items: readonly SelectedItem[]): string {
  const [only] = items;
  if (items.length === 1 && only !== undefined) {
    return `Ask Claude about this ${only.kind}…`;
  }
  return `Ask Claude about these ${String(items.length)}…`;
}

interface FloatingPromptProps {
  handle: SelectionPromptHandle;
  items: readonly SelectedItem[];
  canGroup: boolean;
  onDismiss: () => void;
}

function useAsk(items: readonly SelectedItem[]): [string, (text: string) => void, () => void] {
  const [text, setText] = useState<string>('');
  const send = (): void => {
    if (canSendChat(text)) {
      void sendChat(text, { selection: toChatSelection(items) });
      setText('');
    }
  };
  return [text, setText, send];
}

/** The prompt itself, placed under the selection every frame while it is mounted. */
function FloatingPrompt({ handle, items, canGroup, onDismiss }: FloatingPromptProps): ReactElement {
  const inputId: string = useId();
  const overlayRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  const promptRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  const placement: Placement | null = usePromptPlacement({ overlayRef, promptRef }, handle);
  const [text, setText, send] = useAsk(items);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      send();
    } else if (event.key === 'Escape') {
      event.currentTarget.blur();
      onDismiss();
    }
  };
  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        ref={promptRef}
        role="group"
        aria-label="Ask Claude about the selection"
        data-testid="selection-prompt"
        className={cn(
          'pointer-events-auto absolute z-20 flex w-[300px] max-w-[calc(100%-16px)] items-center gap-1.5 rounded-card border border-input bg-panel py-1.5 pr-1.5 pl-2.5 shadow-menu focus-within:border-ring',
          placement === null && 'invisible',
        )}
        style={{ left: placement?.left ?? 0, top: placement?.top ?? 0 }}
      >
        <label htmlFor={inputId} className="sr-only">
          Ask Claude about the selection
        </label>
        <input
          id={inputId}
          value={text}
          placeholder={promptPlaceholder(items)}
          className="min-w-0 flex-1 border-0 bg-transparent outline-none placeholder:text-faint"
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        {canGroup ? (
          <IconButton
            label="Group selection"
            icon={<SquareDashed />}
            className="size-7"
            onClick={handle.group}
          />
        ) : null}
        <SendButton isStreaming={false} isDisabled={text.trim() === ''} onSend={send} />
      </div>
    </div>
  );
}

export interface SelectionPromptProps {
  /** The open diagram; only its selection gets a prompt. */
  diagramId: string;
}

/**
 * The floating "Ask Claude about these N…" prompt under the canvas selection (PRD §4.1, M1), with
 * Group where the editor can group. Host chrome over every visual editor: editors only call
 * `useSelectionPrompt`. Hidden while Claude is busy, while the canvas is read-only, and after Esc
 * until the selection changes.
 */
export function SelectionPrompt({ diagramId }: SelectionPromptProps): ReactElement | null {
  const { handle, canGroup, isReadOnly } = useSelectionPromptStore();
  const selectedIn: string | null = useCanvasSelectionStore((state) => state.diagramId);
  const items: readonly SelectedItem[] = useCanvasSelectionStore((state) => state.items);
  const isBusy: boolean = useChatStore((state) => state.busyDiagramId !== null);
  const [dismissedFor, setDismissedFor] = useState<readonly SelectedItem[] | null>(null);
  const isShown: boolean =
    selectedIn === diagramId && items.length > 0 && items !== dismissedFor && !isBusy;
  if (handle === null || !isShown || isReadOnly) {
    return null;
  }
  return (
    <FloatingPrompt
      handle={handle}
      items={items}
      canGroup={canGroup}
      onDismiss={() => {
        setDismissedFor(items);
      }}
    />
  );
}
