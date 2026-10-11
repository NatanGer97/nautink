import { describe, expect, it } from 'vitest';

import { createLineSplitter, describeTool, lineToChatEvents, toChatEvents } from './stream-json.ts';

function textDelta(text: string, parentToolUseId?: string | null): unknown {
  return {
    type: 'stream_event',
    ...(parentToolUseId === undefined ? {} : { parent_tool_use_id: parentToolUseId }),
    event: { type: 'content_block_delta', delta: { type: 'text_delta', text } },
  };
}

describe('toChatEvents', () => {
  it('turns the init message into a session event', () => {
    const init = { type: 'system', subtype: 'init', session_id: 's', model: 'm', tools: [] };
    expect(toChatEvents(init)).toEqual([{ type: 'session', sessionId: 's', model: 'm' }]);
  });

  it('streams top-level text deltas only', () => {
    expect(toChatEvents(textDelta('Hi'))).toEqual([{ type: 'delta', text: 'Hi' }]);
    expect(toChatEvents(textDelta('Hi', null))).toEqual([{ type: 'delta', text: 'Hi' }]);
    expect(toChatEvents(textDelta('sub-agent', 'tool-1'))).toEqual([]);
  });

  it('marks a new assistant message as a turn and ignores other stream events', () => {
    expect(toChatEvents({ type: 'stream_event', event: { type: 'message_start' } })).toEqual([
      { type: 'turn' },
    ]);
    const jsonDelta = { type: 'content_block_delta', delta: { type: 'input_json_delta' } };
    expect(toChatEvents({ type: 'stream_event', event: jsonDelta })).toEqual([]);
    expect(toChatEvents({ type: 'stream_event', event: { type: 'message_stop' } })).toEqual([]);
  });

  it('reports each tool use in an assistant message', () => {
    const message = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Looking' },
          { type: 'tool_use', name: 'Read', input: { file_path: 'a.ts' } },
          { type: 'tool_use', name: 'Glob' },
        ],
      },
    };
    expect(toChatEvents(message)).toEqual([
      { type: 'tool', label: 'Read a.ts' },
      { type: 'tool', label: 'Glob' },
    ]);
  });

  it('turns the result into done, with defaults for missing numbers', () => {
    const full = {
      type: 'result',
      session_id: 's',
      result: 'ok',
      is_error: true,
      duration_ms: 5,
      total_cost_usd: 0.2,
    };
    expect(toChatEvents(full)).toEqual([
      { type: 'done', sessionId: 's', text: 'ok', isError: true, durationMs: 5, costUsd: 0.2 },
    ]);
    expect(toChatEvents({ type: 'result', session_id: 's' })).toEqual([
      { type: 'done', sessionId: 's', text: '', isError: false, durationMs: 0, costUsd: 0 },
    ]);
  });

  it('ignores anything else', () => {
    expect(toChatEvents({ type: 'user' })).toEqual([]);
    expect(toChatEvents(null)).toEqual([]);
    expect(toChatEvents('text')).toEqual([]);
  });
});

describe('describeTool', () => {
  it('names the tool and its first target, like v1', () => {
    expect(describeTool({ name: 'Read', input: { file_path: 'a.ts', path: 'x' } })).toBe(
      'Read a.ts',
    );
    expect(describeTool({ name: 'Grep', input: { pattern: 'auth', path: 'src' } })).toBe(
      'Grep auth',
    );
    expect(describeTool({ name: 'Glob', input: { path: 'src' } })).toBe('Glob src');
    expect(describeTool({ name: 'Glob', input: { pattern: '', path: 7 } })).toBe('Glob');
  });
});

describe('lineToChatEvents', () => {
  it('skips blank and non-JSON lines', () => {
    expect(lineToChatEvents('   ')).toEqual([]);
    expect(lineToChatEvents('Warning: something')).toEqual([]);
    expect(lineToChatEvents(` ${JSON.stringify(textDelta('x'))} `)).toEqual([
      { type: 'delta', text: 'x' },
    ]);
  });
});

describe('createLineSplitter', () => {
  it('keeps a partial line until its newline arrives', () => {
    const splitter = createLineSplitter();
    expect(splitter.push('ab')).toEqual([]);
    expect(splitter.push('c\nde')).toEqual(['abc']);
    expect(splitter.push('\n\nf\n')).toEqual(['de', '', 'f']);
  });
});
