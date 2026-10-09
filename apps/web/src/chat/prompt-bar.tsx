import { useChatStore } from './chat-store.ts';
import { SendButton } from './send-button.tsx';
import { submitDraft } from './submit-draft.ts';
import { matchesShortcut, SHORTCUTS } from '../lib/shortcuts.ts';
import { useActiveDiagram, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { Diagram } from '@nautink/storage/records';
import type { KeyboardEvent, ReactElement } from 'react';

function isSendKey(event: KeyboardEvent<HTMLInputElement>): boolean {
  const isPlainEnter: boolean = event.key === 'Enter' && !event.shiftKey;
  return !event.nativeEvent.isComposing && (isPlainEnter || matchesShortcut(event, SHORTCUTS.send));
}

/**
 * The floating prompt bar shown while the chat panel is closed (M3, M7). It edits the same draft
 * as the chat composer and sends through the same path.
 */
export function PromptBar(): ReactElement {
  const diagram: Diagram | undefined = useActiveDiagram();
  const busyId: string | null = useChatStore((state) => state.busyDiagramId);
  const draft: string = diagram?.draft ?? '';
  const isStreaming: boolean = busyId !== null && busyId === diagram?.id;
  const send = (): void => {
    if (diagram !== undefined) {
      submitDraft(diagram.id, draft);
    }
  };
  return (
    <div className="absolute bottom-5 left-1/2 flex w-[min(460px,calc(100%-32px))] -translate-x-1/2 items-center gap-2 rounded-float border border-input bg-panel py-1.5 pr-1.5 pl-3 shadow-float focus-within:border-ring">
      <label htmlFor="canvas-prompt" className="sr-only">
        Ask Claude to change this diagram
      </label>
      <input
        id="canvas-prompt"
        value={draft}
        placeholder={isStreaming ? 'Claude is replying…' : 'Ask Claude to change this diagram…'}
        className="min-w-0 flex-1 border-0 bg-transparent outline-none placeholder:text-faint"
        onChange={(event) => {
          if (diagram !== undefined) {
            useWorkspaceStore.getState().setDraft(diagram.id, event.target.value);
          }
        }}
        onKeyDown={(event) => {
          if (isSendKey(event)) {
            event.preventDefault();
            send();
          }
        }}
      />
      <SendButton
        isStreaming={isStreaming}
        isDisabled={busyId !== null || draft.trim() === ''}
        onSend={send}
      />
    </div>
  );
}
