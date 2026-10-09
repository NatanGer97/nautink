import { encodeChatEvent } from '@nautink/contracts/sse';

import type { ChatEvent } from '@nautink/contracts/chat';

/** A `text/event-stream` response that sends `chunks` one by one. */
export function sseResponse(chunks: readonly string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller): void {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

/** An SSE response carrying `events`, one chunk each. */
export function eventsResponse(events: readonly ChatEvent[]): Response {
  return sseResponse(events.map(encodeChatEvent));
}

/** The events of a reply that streams `text` in two parts and finishes. */
export function replyEvents(text: string, sessionId: string = 'session-1'): ChatEvent[] {
  const half = Math.floor(text.length / 2);
  return [
    { type: 'session', sessionId, model: 'opus' },
    { type: 'delta', text: text.slice(0, half) },
    { type: 'delta', text: text.slice(half) },
    { type: 'done', sessionId, text, isError: false, durationMs: 1500, costUsd: 0.01 },
  ];
}

/**
 * A stream the test drives: `send` pushes events, `end` closes it. The response rejects with an
 * `AbortError` when the request's signal aborts, like `fetch` does.
 */
export interface ControlledStream {
  response: (init?: RequestInit) => Response;
  send: (event: ChatEvent) => void;
  end: () => void;
}

export function controlledStream(): ControlledStream {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(started): void {
      controller = started;
    },
  });
  return {
    response: (init): Response => {
      init?.signal?.addEventListener('abort', (): void => {
        controller?.error(new DOMException('The operation was aborted.', 'AbortError'));
      });
      return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
    },
    send: (event): void => {
      controller?.enqueue(encoder.encode(encodeChatEvent(event)));
    },
    end: (): void => {
      controller?.close();
    },
  };
}
