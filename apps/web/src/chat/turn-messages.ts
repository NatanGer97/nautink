import { startReply, toAssistantMessage } from './chat-reply.ts';
import { useChatStore } from './chat-store.ts';
import { findTurnDiagram } from './turn-edit.ts';

import type { SendKind } from './auto-fix.ts';
import type { ChatReply } from './chat-reply.ts';
import type { WorkspaceState } from '../workspace/workspace-state.ts';
import type { AgentId } from '@nautink/contracts/agents';
import type { ChatMessage, Diagram } from '@nautink/storage/records';

/** Where a turn writes its messages, and the agent that writes them. */
export interface MessageTarget {
  diagramId: string;
  workspace: () => WorkspaceState;
  agent: AgentId;
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
  const exchange: ChatMessage[] = [
    userMessage(text, kind),
    toAssistantMessage(startReply(null), target.agent),
  ];
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
      toAssistantMessage(reply, target.agent),
    ]);
}

/** The session id of `diagram` that `agent` can resume; another agent's session gives `null`. */
export function sessionFor(diagram: Diagram | undefined, agent: AgentId): string | null {
  // A session saved before ADR-002 has no agent: it is Claude's.
  const owner: AgentId = diagram?.sessionAgent ?? 'claude';
  return owner === agent ? (diagram?.sessionId ?? null) : null;
}

/** Keeps the agent's session id on the diagram, so the next message resumes it. */
export function writeSession(target: MessageTarget, sessionId: string | null): void {
  const diagram: Diagram | undefined = findTurnDiagram(target.workspace(), target.diagramId);
  const isNew: boolean = sessionFor(diagram, target.agent) !== sessionId;
  if (canWrite(target) && sessionId !== null && isNew) {
    target.workspace().setSessionId(target.diagramId, sessionId, target.agent);
  }
}
