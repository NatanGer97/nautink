import { MODEL_LABELS } from '@nautink/contracts/models';
import { Badge } from '@nautink/ui/components/badge';
import { IconButton } from '@nautink/ui/icon-button';
import { ArrowUp, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { EmptyState } from './empty-state.tsx';
import { PanelHeader } from './panel-header.tsx';
import { SHORTCUTS, shortcutLabel } from '../../lib/shortcuts.ts';
import { useUiStore } from '../../state/ui-store.ts';

import type { ModelId } from '@nautink/contracts/models';
import type { ReactElement, RefObject } from 'react';

/** Placeholder composer. ⌘/ focuses it; sending arrives with the chat feature. */
function ChatComposer(): ReactElement {
  const focusRequest: number = useUiStore((state) => state.composerFocusRequest);
  const textareaRef: RefObject<HTMLTextAreaElement | null> = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focusRequest > 0) {
      textareaRef.current?.focus();
    }
  }, [focusRequest]);
  return (
    <div className="shrink-0 border-t border-border-subtle p-3">
      <div className="flex flex-col gap-2 rounded-card border border-input bg-panel p-2 pl-2.5 focus-within:border-ring">
        <label htmlFor="chat-composer" className="sr-only">
          Message Claude
        </label>
        <textarea
          id="chat-composer"
          ref={textareaRef}
          rows={2}
          placeholder="Describe a change…"
          className="resize-none border-0 bg-transparent leading-normal outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between">
          <span className="text-2xs text-muted-foreground">
            {shortcutLabel(SHORTCUTS.send)} to send · {shortcutLabel(SHORTCUTS.focusComposer)} to
            focus
          </span>
          <IconButton
            label="Send"
            shortcut={shortcutLabel(SHORTCUTS.send)}
            icon={<ArrowUp className="stroke-2" />}
            isDisabled
            className="rounded-track bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          />
        </div>
      </div>
    </div>
  );
}

/** The chat side panel (M1). Messages and sending are seams for the chat feature. */
export function ChatPanel(): ReactElement {
  const model: ModelId | null = useUiStore((state) => state.defaultModel);
  return (
    <>
      <PanelHeader
        title="Chat"
        actions={
          <>
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {model === null ? 'Default model' : MODEL_LABELS[model]}
            </Badge>
            <IconButton label="New chat" icon={<Plus />} isDisabled />
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto" data-slot="chat-messages">
        <EmptyState title="Start with a description">
          Describe the diagram you want and Claude will draw it on the canvas.
        </EmptyState>
      </div>
      <ChatComposer />
    </>
  );
}
