import { describe, expect, it } from 'vitest';

import { createChatStreamDecoder, decodeChatFrame, encodeChatEvent } from './sse.ts';

import type { ChatEvent } from './chat.ts';

describe('encodeChatEvent', () => {
  it('writes the type as the SSE event name and the rest as data', () => {
    expect(encodeChatEvent({ type: 'delta', text: 'Hi' })).toBe(
      'event: delta\ndata: {"text":"Hi"}\n\n',
    );
  });
});

describe('decodeChatFrame', () => {
  it('round-trips every event through a frame', () => {
    const events: ChatEvent[] = [
      { type: 'turn' },
      { type: 'tool', label: 'Grep auth' },
      { type: 'done', sessionId: 's', text: '', isError: true, durationMs: 1, costUsd: 0.01 },
    ];
    for (const event of events) {
      expect(decodeChatFrame(encodeChatEvent(event).trim())).toEqual(event);
    }
  });

  it('treats a frame with no data line as an empty payload', () => {
    expect(decodeChatFrame('event: turn')).toEqual({ type: 'turn' });
  });

  it('ignores comment and id lines', () => {
    expect(decodeChatFrame(': keep-alive\nid: 7\nevent: turn')).toEqual({ type: 'turn' });
  });

  it('throws on a frame that is not a known event', () => {
    expect(() => decodeChatFrame('data: {"text":"no event name"}')).toThrow();
  });
});

describe('createChatStreamDecoder', () => {
  it('returns events only once their frame is complete, across chunk boundaries', () => {
    const decoder = createChatStreamDecoder();
    const wire = encodeChatEvent({ type: 'delta', text: 'a' }) + encodeChatEvent({ type: 'turn' });
    expect(decoder.push(wire.slice(0, 10))).toEqual([]);
    expect(decoder.push(wire.slice(10, 40))).toEqual([{ type: 'delta', text: 'a' }]);
    expect(decoder.push(wire.slice(40))).toEqual([{ type: 'turn' }]);
  });
});
