import { useEffect, useRef } from 'react';

import { useAgentName } from './agent-name.ts';
import { AssistantMessage, UserMessage } from './chat-message.tsx';
import { ChipButton } from './chip-button.tsx';
import { EXAMPLE_PROMPTS, hasDiagramContent } from './quick-actions.ts';
import { sendChat } from './send-chat.ts';
import { EmptyState } from '../shell/panels/empty-state.tsx';

import type { ChatMessage, Diagram } from '@nautink/storage/records';
import type { ReactElement, ReactNode, RefObject } from 'react';

export interface MessageListProps {
  diagram: Diagram;
  /** Shown under the latest Claude reply once it has finished (quick actions). */
  latestReplyFooter?: ReactNode;
}

/** v1's welcome: what the chat does, and example prompts to start from. */
function ChatWelcome({ hasContent }: { hasContent: boolean }): ReactElement {
  const name: string = useAgentName();
  if (hasContent) {
    return (
      <EmptyState title="Ask about this diagram">
        Describe a change, or pick a quick action below. {name} edits the code; you can edit it too.
      </EmptyState>
    );
  }
  return (
    <EmptyState
      title="Start with a description"
      action={
        <div className="mt-2 flex flex-col items-stretch gap-1.5">
          {EXAMPLE_PROMPTS.map((example) => (
            <ChipButton
              key={example}
              className="h-auto py-1.5 text-left whitespace-normal"
              onClick={() => void sendChat(example)}
            >
              {example}
            </ChipButton>
          ))}
        </div>
      }
    >
      Describe the diagram you want and {name} will draw it on the canvas. You can edit it too.
    </EmptyState>
  );
}

function lastAssistantIndex(messages: readonly ChatMessage[]): number {
  return messages.map((message) => message.role).lastIndexOf('assistant');
}

interface MessageItemProps {
  diagramId: string;
  message: ChatMessage;
  index: number;
  footer: ReactNode;
}

function MessageItem({ diagramId, message, index, footer }: MessageItemProps): ReactElement {
  if (message.role === 'user') {
    return <UserMessage message={message} />;
  }
  return (
    <AssistantMessage
      message={message}
      diagramId={diagramId}
      messageIndex={index}
      footer={message.streaming === true ? null : footer}
    />
  );
}

/** The diagram's conversation, kept scrolled to the newest message. */
export function MessageList({ diagram, latestReplyFooter }: MessageListProps): ReactElement {
  const listRef: RefObject<HTMLElement | null> = useRef<HTMLElement>(null);
  const { messages } = diagram;
  useEffect(() => {
    const list: HTMLElement | null = listRef.current;
    if (list !== null) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);
  if (messages.length === 0) {
    return <ChatWelcome hasContent={hasDiagramContent(diagram.code)} />;
  }
  const latest: number = lastAssistantIndex(messages);
  return (
    // Not a live region: the stream would be read out chunk by chunk. `ChatAnnouncer` says when a
    // reply starts and ends instead.
    <section
      ref={listRef}
      aria-label="Messages"
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4"
    >
      {messages.map((message, index) => (
        // Messages only ever append (or all clear), so the position is a stable key.
        <MessageItem
          key={`${diagram.id}:${String(index)}`}
          diagramId={diagram.id}
          message={message}
          index={index}
          footer={index === latest ? latestReplyFooter : null}
        />
      ))}
    </section>
  );
}
