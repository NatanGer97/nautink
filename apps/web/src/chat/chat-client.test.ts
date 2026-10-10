import { encodeChatEvent } from '@nautink/contracts/sse';
import { describe, expect, it, vi } from 'vitest';

import { streamChat } from './chat-client.ts';
import { sseResponse } from '../../tests/chat-stream.ts';

import type { ChatEvent, ChatRequest } from '@nautink/contracts/chat';

const REQUEST: ChatRequest = {
  message: 'Draw a flow',
  code: 'flowchart TD',
  sessionId: null,
  agent: 'claude',
  model: 'opus',
  selection: null,
};

async function collect(fetchImpl: () => Promise<Response>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  await streamChat({
    request: REQUEST,
    signal: new AbortController().signal,
    onEvent: (event) => events.push(event),
    fetchImpl,
  });
  return events;
}

describe('streamChat', () => {
  it('posts the request and decodes events split across chunks', async () => {
    const frames = [
      encodeChatEvent({ type: 'session', sessionId: 's1', model: 'opus' }),
      encodeChatEvent({ type: 'delta', text: 'Hi' }),
    ].join('');
    const fetchImpl = vi.fn(async () =>
      Promise.resolve(sseResponse([frames.slice(0, 20), frames.slice(20)])),
    );
    const events = await collect(fetchImpl);
    expect(events).toEqual([
      { type: 'session', sessionId: 's1', model: 'opus' },
      { type: 'delta', text: 'Hi' },
    ]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/chat');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(REQUEST);
  });

  it('throws the server error message, or the status when there is none', async () => {
    const jsonError = new Response(JSON.stringify({ error: 'message: message is required' }), {
      status: 400,
    });
    await expect(collect(async () => Promise.resolve(jsonError))).rejects.toThrow(
      'message: message is required',
    );
    const htmlError = new Response('<html>', { status: 502 });
    await expect(collect(async () => Promise.resolve(htmlError))).rejects.toThrow(
      'The server answered 502 for /api/chat.',
    );
  });

  it('throws when the reply has no body or an unknown event', async () => {
    await expect(collect(async () => Promise.resolve(new Response(null)))).rejects.toThrow(
      /no reply body/,
    );
    const bad = sseResponse(['event: nope\ndata: {}\n\n']);
    await expect(collect(async () => Promise.resolve(bad))).rejects.toThrow();
  });
});
