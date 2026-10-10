import type { AgentId } from '@nautink/contracts/agents';
import type { ChatEvent } from '@nautink/contracts/chat';
import type { ChatMessage, ChatMessageMeta } from '@nautink/storage/records';

/** Where one reply stands. */
export type ReplyStatus = 'streaming' | 'done' | 'error' | 'stopped';

/** One Claude reply as the SSE events build it up. */
export interface ChatReply {
  text: string;
  tools: readonly string[];
  sessionId: string | null;
  status: ReplyStatus;
  error: string | null;
  meta: ChatMessageMeta | null;
}

/** Shown when the user presses Stop (as v1). */
export const STOPPED_MESSAGE: string = 'Stopped.';

/** Shown when the stream ends without a `done` or `error` event. */
export const CUT_OFF_MESSAGE: string = 'The reply ended before Claude finished. Try again.';

/** An empty reply that resumes `sessionId`. */
export function startReply(sessionId: string | null): ChatReply {
  return { text: '', tools: [], sessionId, status: 'streaming', error: null, meta: null };
}

/** A new assistant turn inside one reply starts on its own paragraph. */
function breakTurn(text: string): string {
  return text === '' || text.endsWith('\n') ? text : `${text}\n\n`;
}

function finishReply(reply: ChatReply, event: Extract<ChatEvent, { type: 'done' }>): ChatReply {
  const text: string = event.text === '' ? reply.text : event.text;
  return {
    ...reply,
    text,
    sessionId: event.sessionId === '' ? reply.sessionId : event.sessionId,
    status: event.isError ? 'error' : 'done',
    error: event.isError ? text : null,
    meta: { durationMs: event.durationMs, costUsd: event.costUsd },
  };
}

/** The reply after one SSE event. Pure, so the stream can be replayed in tests. */
export function applyChatEvent(reply: ChatReply, event: ChatEvent): ChatReply {
  switch (event.type) {
    case 'session':
      return { ...reply, sessionId: event.sessionId };
    case 'delta':
      return { ...reply, text: reply.text + event.text };
    case 'turn':
      return { ...reply, text: breakTurn(reply.text) };
    case 'tool':
      return { ...reply, tools: [...reply.tools, event.label] };
    case 'done':
      return finishReply(reply, event);
    case 'error':
      return { ...reply, status: 'error', error: event.message };
  }
}

/** The reply once the stream is over: still streaming means it was cut off. */
export function settleReply(reply: ChatReply): ChatReply {
  return reply.status === 'streaming'
    ? { ...reply, status: 'error', error: CUT_OFF_MESSAGE }
    : reply;
}

/** The reply after the request failed or was stopped. */
export function failReply(reply: ChatReply, err: unknown, isStopped: boolean): ChatReply {
  if (isStopped) {
    return { ...reply, status: 'stopped', error: STOPPED_MESSAGE };
  }
  const message: string = err instanceof Error ? err.message : String(err);
  return { ...reply, status: 'error', error: message };
}

/** The stored chat bubble for a reply, in v1's shape. */
export function toAssistantMessage(reply: ChatReply, agent: AgentId): ChatMessage {
  const message: ChatMessage = {
    role: 'assistant',
    text: reply.text,
    tools: [...reply.tools],
    streaming: reply.status === 'streaming',
    agent,
  };
  if (reply.error !== null) {
    message.error = reply.error;
  }
  if (reply.meta !== null) {
    message.meta = reply.meta;
  }
  return message;
}
