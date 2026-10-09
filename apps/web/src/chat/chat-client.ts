import { API_ROUTES } from '@nautink/contracts/routes';
import { errorResponseSchema } from '@nautink/contracts/server-info';
import { createChatStreamDecoder } from '@nautink/contracts/sse';

import type { ChatEvent, ChatRequest } from '@nautink/contracts/chat';
import type { ErrorResponse } from '@nautink/contracts/server-info';
import type { ChatStreamDecoder } from '@nautink/contracts/sse';
import type { z } from 'zod';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface StreamChatOptions {
  request: ChatRequest;
  /** Aborting it stops the request; the server then stops Claude. */
  signal: AbortSignal;
  /** Called once per SSE event, in order. */
  onEvent: (event: ChatEvent) => void;
  fetchImpl?: FetchLike;
}

/** The server's `{ error }` text, or the status when the body is not one. */
async function describeFailure(response: Response): Promise<string> {
  const fallback: string = `The server answered ${String(response.status)} for ${API_ROUTES.chat}.`;
  try {
    const parsed: z.ZodSafeParseResult<ErrorResponse> = errorResponseSchema.safeParse(
      await response.json(),
    );
    return parsed.success ? parsed.data.error : fallback;
  } catch {
    return fallback;
  }
}

async function openChat(options: StreamChatOptions): Promise<ReadableStream<Uint8Array>> {
  const { request, signal, fetchImpl = fetch } = options;
  const response: Response = await fetchImpl(API_ROUTES.chat, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) {
    throw new Error(await describeFailure(response));
  }
  if (response.body === null) {
    throw new Error(`The server sent no reply body for ${API_ROUTES.chat}.`);
  }
  return response.body;
}

async function readEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ChatEvent) => void,
): Promise<void> {
  const reader: ReadableStreamDefaultReader<Uint8Array> = body.getReader();
  const text: TextDecoder = new TextDecoder();
  const frames: ChatStreamDecoder = createChatStreamDecoder();
  for (;;) {
    const { done: isDone, value } = await reader.read();
    const chunk: string = isDone ? text.decode() : text.decode(value, { stream: true });
    frames.push(chunk).forEach(onEvent);
    if (isDone) {
      return;
    }
  }
}

/**
 * `POST /api/chat` and its SSE stream, decoded into typed events. Throws on a failed request, an
 * unknown event, or an abort (`signal`); resolves when the stream ends.
 */
export async function streamChat(options: StreamChatOptions): Promise<void> {
  const body: ReadableStream<Uint8Array> = await openChat(options);
  await readEvents(body, options.onEvent);
}
