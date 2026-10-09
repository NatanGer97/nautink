import { describe, expect, it } from 'vitest';

import {
  applyChatEvent,
  CUT_OFF_MESSAGE,
  failReply,
  settleReply,
  startReply,
  STOPPED_MESSAGE,
  toAssistantMessage,
} from './chat-reply.ts';

import type { ChatReply } from './chat-reply.ts';
import type { ChatEvent } from '@nautink/contracts/chat';

function replay(events: ChatEvent[], from: ChatReply = startReply(null)): ChatReply {
  return events.reduce(applyChatEvent, from);
}

describe('applyChatEvent', () => {
  it('builds text, tool steps and the session from the stream', () => {
    const reply = replay([
      { type: 'session', sessionId: 's1', model: 'opus' },
      { type: 'delta', text: 'Reading' },
      { type: 'tool', label: 'Read src/app.ts' },
      { type: 'turn' },
      { type: 'delta', text: 'Done.' },
    ]);
    expect(reply).toMatchObject({
      text: 'Reading\n\nDone.',
      tools: ['Read src/app.ts'],
      sessionId: 's1',
      status: 'streaming',
    });
    expect(applyChatEvent(startReply(null), { type: 'turn' }).text).toBe('');
    expect(replay([{ type: 'delta', text: 'a\n' }, { type: 'turn' }]).text).toBe('a\n');
  });

  it('finishes with the final text, timing and session, keeping streamed text when empty', () => {
    const done = replay([
      { type: 'delta', text: 'partial' },
      {
        type: 'done',
        sessionId: 's2',
        text: 'full',
        isError: false,
        durationMs: 1200,
        costUsd: 0.01,
      },
    ]);
    expect(done).toMatchObject({ text: 'full', sessionId: 's2', status: 'done', error: null });
    expect(done.meta).toEqual({ durationMs: 1200, costUsd: 0.01 });
    const kept = replay(
      [
        { type: 'delta', text: 'streamed' },
        { type: 'done', sessionId: '', text: '', isError: false, durationMs: 1, costUsd: 0 },
      ],
      startReply('s0'),
    );
    expect(kept).toMatchObject({ text: 'streamed', sessionId: 's0' });
  });

  it('turns an error result or an error event into an error reply', () => {
    const isError = replay([
      {
        type: 'done',
        sessionId: 's',
        text: 'Rate limited',
        isError: true,
        durationMs: 1,
        costUsd: 0,
      },
    ]);
    expect(isError).toMatchObject({ status: 'error', error: 'Rate limited' });
    expect(replay([{ type: 'error', message: 'claude not found' }])).toMatchObject({
      status: 'error',
      error: 'claude not found',
    });
  });
});

describe('settling and failing', () => {
  it('marks a reply cut off when the stream ends early, and leaves finished ones alone', () => {
    expect(settleReply(startReply(null))).toMatchObject({
      status: 'error',
      error: CUT_OFF_MESSAGE,
    });
    const done = replay([
      { type: 'done', sessionId: 's', text: 't', isError: false, durationMs: 1, costUsd: 0 },
    ]);
    expect(settleReply(done)).toBe(done);
  });

  it('says Stopped. for a stop and the message for any other failure', () => {
    expect(failReply(startReply(null), new Error('x'), true)).toMatchObject({
      status: 'stopped',
      error: STOPPED_MESSAGE,
    });
    expect(failReply(startReply(null), new Error('Server error 500'), false).error).toBe(
      'Server error 500',
    );
    expect(failReply(startReply(null), 'boom', false).error).toBe('boom');
  });
});

describe('toAssistantMessage', () => {
  it('stores the reply in the v1 message shape', () => {
    expect(toAssistantMessage(startReply(null))).toEqual({
      role: 'assistant',
      text: '',
      tools: [],
      streaming: true,
    });
    const failed = failReply(startReply(null), new Error('nope'), false);
    expect(toAssistantMessage(failed)).toMatchObject({ streaming: false, error: 'nope' });
    const done = replay([
      { type: 'done', sessionId: 's', text: 't', isError: false, durationMs: 5, costUsd: 0 },
    ]);
    expect(toAssistantMessage(done).meta).toEqual({ durationMs: 5, costUsd: 0 });
  });
});
