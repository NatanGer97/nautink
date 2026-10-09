import { EmptyState } from './empty-state.tsx';
import { PanelHeader } from './panel-header.tsx';
import { ChatComposer } from '../../chat/chat-composer.tsx';
import { MessageList } from '../../chat/message-list.tsx';
import { ModelChip } from '../../chat/model-chip.tsx';
import { NewChatButton } from '../../chat/new-chat-button.tsx';
import { useActiveDiagram } from '../../workspace/use-workspace.ts';

import type { Diagram } from '@nautink/storage/records';
import type { ReactElement } from 'react';

/** The chat side panel (M1): model, new chat, the open diagram's conversation and the composer. */
export function ChatPanel(): ReactElement {
  const diagram: Diagram | undefined = useActiveDiagram();
  return (
    <>
      <PanelHeader
        title="Chat"
        actions={
          <>
            <ModelChip />
            <NewChatButton />
          </>
        }
      />
      {diagram === undefined ? (
        <EmptyState title="Opening your diagrams…">This takes a moment.</EmptyState>
      ) : (
        <MessageList diagram={diagram} />
      )}
      <ChatComposer diagram={diagram} />
    </>
  );
}
