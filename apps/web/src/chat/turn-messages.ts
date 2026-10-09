import { startReply, toAssistantMessage } from './chat-reply.ts';
import { useChatStore } from './chat-store.ts';
import { findTurnDiagram } from './turn-edit.ts';

import type { SendKind } from './auto-fix.ts';
import type { ChatReply } from './chat-reply.ts';
import type { WorkspaceState } from '../workspace/workspace-state.ts';
import type { ChatMessage } from '@nautink/storage/records';

/** Where a turn writes its messages. */
export interface MessageTarget {
  diagramId: string;
  workspace: () => WorkspaceState;
}

/** False once the diagram is gone or New chat cleared the reply, so nothing more is written. */
function canWrite(target: MessageTarget): boolean {
  const isPresent: boolean = findTurnDiagram(target.workspace(), target.diagramId) !== undefined;
  return isPresent && !useChatStore.getState().isDiscarded;
}

function userMessage(text: string, kind: SendKind): ChatMessage {
  return kind === 'user' ? { role: 'user', text } : { role: 'user', text, auto: true };
}

/** Appends the user's message and an empty streaming reply. Returns the reply's index. */
export function appendExchange(
  target: MessageTarget,
  { text, kind }: { text: string; kind: SendKind },
): number {
  if (!canWrite(target)) {
    return -1;
  }
  const exchange: ChatMessage[] = [userMessage(text, kind), toAssistantMessage(startReply(null))];
  target.workspace().updateMessages(target.diagramId, (messages) => [...messages, ...exchange]);
  return (findTurnDiagram(target.workspace(), target.diagramId)?.messages.length ?? 0) - 1;
}

/** Replaces the last message (the streaming reply) with `reply`. */
export function writeReply(target: MessageTarget, reply: ChatReply): void {
  if (!canWrite(target)) {
    return;
  }
  target
    .workspace()
    .updateMessages(target.diagramId, (messages) => [
      ...messages.slice(0, -1),
      toAssistantMessage(reply),
    ]);
}

/** Keeps the Claude session id on the diagram, so the next message resumes it. */
export function writeSession(target: MessageTarget, sessionId: string | null): void {
  const current: string | null | undefined = findTurnDiagram(
    target.workspace(),
    target.diagramId,
  )?.sessionId;
  if (canWrite(target) && sessionId !== null && current !== sessionId) {
    target.workspace().setSessionId(target.diagramId, sessionId);
  }
}
