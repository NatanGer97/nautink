import { useEffect, useRef } from 'react';

import { useAgentName } from './agent-name.ts';
import { useChatStore } from './chat-store.ts';
import { useReplyingAgentName } from './replying-agent.ts';
import { SelectionChip } from './selection-chip.tsx';
import { SendButton } from './send-button.tsx';
import { isSendKey } from './send-key.ts';
import { submitDraft } from './submit-draft.ts';
import { SHORTCUTS, shortcutLabel } from '../lib/shortcuts.ts';
import { useUiStore } from '../state/ui-store.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { Diagram } from '@nautink/storage/records';
import type { KeyboardEvent, ReactElement, ReactNode, RefObject } from 'react';

export interface ChatComposerProps {
  /** The open diagram, whose `draft` the composer edits; undefined while the workspace loads. */
  diagram: Diagram | undefined;
  /** Shown above the message box, such as quick actions while the chat is empty. */
  above?: ReactNode;
}

function placeholder(busyId: string | null, diagramId: string | undefined, name: string): string {
  if (busyId === null) {
    return 'Describe a change…';
  }
  return busyId === diagramId ? `${name} is replying…` : `${name} is replying in another diagram…`;
}

/** Takes focus each time ⌘/ asks for it. */
function useComposerFocus(textareaRef: RefObject<HTMLTextAreaElement | null>): void {
  const focusRequest: number = useUiStore((state) => state.composerFocusRequest);
  useEffect(() => {
    if (focusRequest > 0) {
      textareaRef.current?.focus();
    }
  }, [focusRequest, textareaRef]);
}

/** The message box (M1). Its text is the diagram's draft, so it survives switching diagrams. */
export function ChatComposer({ diagram, above }: ChatComposerProps): ReactElement {
  const textareaRef: RefObject<HTMLTextAreaElement | null> = useRef<HTMLTextAreaElement>(null);
  const busyId: string | null = useChatStore((state) => state.busyDiagramId);
  const name: string = useAgentName();
  const replyingName: string = useReplyingAgentName();
  useComposerFocus(textareaRef);
  const draft: string = diagram?.draft ?? '';
  const send = (): void => {
    if (diagram !== undefined) {
      submitDraft(diagram.id, draft);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (isSendKey(event)) {
      event.preventDefault();
      send();
    }
  };
  return (
    <div className="flex shrink-0 flex-col gap-2.5 border-t border-border-subtle p-3">
      {above}
      <div className="flex flex-col gap-2 rounded-card border border-input bg-panel p-2 pl-2.5 focus-within:border-ring">
        <SelectionChip diagramId={diagram?.id} className="self-start" />
        <label htmlFor="chat-composer" className="sr-only">
          Message {name}
        </label>
        <textarea
          id="chat-composer"
          ref={textareaRef}
          rows={2}
          value={draft}
          placeholder={placeholder(busyId, diagram?.id, replyingName)}
          className="resize-none border-0 bg-transparent leading-normal outline-none placeholder:text-faint"
          onChange={(event) => {
            if (diagram !== undefined) {
              useWorkspaceStore.getState().setDraft(diagram.id, event.target.value);
            }
          }}
          onKeyDown={onKeyDown}
        />
        <div className="flex items-center justify-between">
          <span className="text-2xs text-faint">
            ↵ to send · ⇧↵ for a new line · {shortcutLabel(SHORTCUTS.focusComposer)} to focus
          </span>
          <SendButton
            isStreaming={busyId !== null && busyId === diagram?.id}
            isDisabled={busyId !== null || draft.trim() === ''}
            onSend={send}
          />
        </div>
      </div>
    </div>
  );
}
