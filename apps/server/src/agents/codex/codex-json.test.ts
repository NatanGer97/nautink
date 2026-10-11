import { describe, expect, it } from 'vitest';

import { createCodexParser, describeCommand } from './codex-json.ts';

import type { ChatEvent } from '@nautink/contracts/chat';

const THREAD = { type: 'thread.started', thread_id: 't-1' };

function message(text: string): unknown {
  return { type: 'item.completed', item: { id: 'i', type: 'agent_message', text } };
}

function command(type: 'item.started' | 'item.completed', cmd: string): unknown {
  return {
    type,
    item: { id: 'c', type: 'command_execution', command: cmd, exit_code: null, status: 'x' },
  };
}

const COMPLETED = { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 2 } };

/** Feeds the lines to a fresh parser whose clock reads 1000, then 1250. */
function parse(lines: unknown[], model: string | null = null): ChatEvent[] {
  const times: number[] = [1000, 1250];
  const parser = createCodexParser({ model, now: () => times.shift() ?? 1250 });
  return lines.flatMap((line: unknown) =>
    parser.parseLine(typeof line === 'string' ? line : JSON.stringify(line)),
  );
}

describe('createCodexParser', () => {
  it('reports the thread as the session, with the requested model', () => {
    expect(parse([THREAD], 'gpt-6-astra')).toEqual([
      { type: 'session', sessionId: 't-1', model: 'gpt-6-astra' },
    ]);
    expect(parse([THREAD])).toEqual([{ type: 'session', sessionId: 't-1', model: 'default' }]);
  });

  it('sends each agent message whole, later ones on a new turn', () => {
    expect(parse([message('Looking.'), message('Done.')])).toEqual([
      { type: 'delta', text: 'Looking.' },
      { type: 'turn' },
      { type: 'delta', text: 'Done.' },
    ]);
  });

  it('reports a shell command once, when it starts', () => {
    const cmd = `/bin/zsh -lc "rg --files src -g '*.ts'"`;
    expect(parse([command('item.started', cmd), command('item.completed', cmd)])).toEqual([
      { type: 'tool', label: "Run rg --files src -g '*.ts'" },
    ]);
  });

  it('ends with the last message, the measured time and no cost', () => {
    expect(parse([THREAD, message('First.'), message('Last.'), COMPLETED]).at(-1)).toEqual({
      type: 'done',
      sessionId: 't-1',
      text: 'Last.',
      isError: false,
      durationMs: 250,
      costUsd: null,
    });
  });

  it('turns a failed turn into an error', () => {
    const failed = { type: 'turn.failed', error: { message: 'model not found' } };
    expect(parse([failed])).toEqual([{ type: 'error', message: 'model not found' }]);
  });

  it('ignores reconnect notices, reasoning, other items and noise', () => {
    const reasoning = { type: 'item.completed', item: { id: 'r', type: 'reasoning', text: 'hm' } };
    expect(
      parse([
        { type: 'error', message: 'Reconnecting... 1/5' },
        { type: 'turn.started' },
        reasoning,
        '',
        'not json',
      ]),
    ).toEqual([]);
  });
});

describe('describeCommand', () => {
  it('unwraps the login shell and its escaped quotes', () => {
    expect(describeCommand('/bin/zsh -lc "cat \\"a b.ts\\""')).toBe('Run cat "a b.ts"');
    expect(describeCommand("bash -c 'ls -la'")).toBe('Run ls -la');
    expect(describeCommand('ls')).toBe('Run ls');
  });

  it('clips a long command to 80 characters', () => {
    const label: string = describeCommand(`echo ${'x'.repeat(200)}`);
    expect(label).toHaveLength(80);
    expect(label.endsWith('…')).toBe(true);
  });
});
