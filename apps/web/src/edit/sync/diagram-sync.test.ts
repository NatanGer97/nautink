import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUSY_PARSE_DELAY_MS, DiagramSync, PARSE_DELAY_MS } from './diagram-sync.ts';

import type { DiagramSyncOptions } from './diagram-sync.ts';
import type { ParseResult } from '@nautink/visual-core/editor-contract';

/** A model that is just the list of lines; "!" anywhere is a syntax error, "pie" another type. */
interface Lines {
  lines: string[];
}

async function parseLines(code: string): Promise<ParseResult<Lines>> {
  if (code.includes('!')) {
    return Promise.resolve({ kind: 'error', message: 'Bad line' });
  }
  if (code.startsWith('pie')) {
    return Promise.resolve({ kind: 'unsupported', message: 'pie' });
  }
  return Promise.resolve({ kind: 'ok', model: { lines: code.split('\n') } });
}

function createSync(overrides: Partial<DiagramSyncOptions<Lines>> = {}): DiagramSync<Lines> {
  return new DiagramSync<Lines>({
    module: { parse: parseLines, serialize: (model) => model.lines.join('\n') },
    load: vi.fn(),
    ...overrides,
  });
}

async function settle(ms: number = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DiagramSync', () => {
  it('parses the first code at once and later code after a pause', async () => {
    const sync = createSync();
    sync.receive('a', false);
    await settle();
    expect(sync.getModel()).toEqual({ lines: ['a'] });
    sync.receive('a\nb', false);
    await settle(PARSE_DELAY_MS - 1);
    expect(sync.getModel()).toEqual({ lines: ['a'] });
    await settle(1);
    expect(sync.getModel()).toEqual({ lines: ['a', 'b'] });
  });

  it('parses sooner while Claude streams, and only the newest code', async () => {
    const sync = createSync();
    sync.receive('a', false);
    await settle();
    sync.receive('a\nb', true);
    sync.receive('a\nb\nc', true);
    await settle(BUSY_PARSE_DELAY_MS);
    expect(sync.getModel()).toEqual({ lines: ['a', 'b', 'c'] });
  });

  it('writes a commit as one labelled step and never parses its own code back', async () => {
    const onExternal = vi.fn();
    const write = vi.fn();
    const sync = createSync({ onExternal });
    sync.setWriter(write);
    sync.receive('a', false);
    await settle();
    expect(onExternal).toHaveBeenCalledTimes(1);
    sync.commit({ lines: ['a', 'b'] }, 'Added node b');
    expect(write).toHaveBeenCalledWith('a\nb', 'Added node b');
    sync.receive('a\nb', false);
    await settle(PARSE_DELAY_MS);
    expect(onExternal).toHaveBeenCalledTimes(1);
  });

  it('tells the editor about outside changes before showing them (undo, Claude)', async () => {
    const onExternal = vi.fn();
    const sync = createSync({ onExternal });
    sync.receive('a', false);
    await settle();
    sync.commit({ lines: ['a', 'b'] }, 'Added node b');
    sync.receive('a', false);
    await settle(PARSE_DELAY_MS);
    expect(onExternal).toHaveBeenLastCalledWith({ lines: ['a'] }, { lines: ['a', 'b'] });
  });

  it('keeps the last model on a syntax error and drops it for another diagram type', async () => {
    const sync = createSync();
    const listener = vi.fn();
    sync.subscribe(listener);
    sync.receive('a', false);
    await settle();
    sync.receive('a!', false);
    await settle(PARSE_DELAY_MS);
    expect(sync.getSnapshot()).toEqual({
      model: { lines: ['a'] },
      failure: { kind: 'error', message: 'Bad line' },
    });
    sync.receive('pie', false);
    await settle(PARSE_DELAY_MS);
    expect(sync.getSnapshot()).toEqual({
      model: null,
      failure: { kind: 'unsupported', message: 'pie' },
    });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('shows a canvas-only model, and drops pending parses when disposed', async () => {
    const sync = createSync();
    const unsubscribe = sync.subscribe(vi.fn());
    sync.setModel({ lines: ['laid out'] });
    expect(sync.getModel()).toEqual({ lines: ['laid out'] });
    sync.receive('b', false);
    sync.dispose();
    await settle(PARSE_DELAY_MS);
    expect(sync.getModel()).toEqual({ lines: ['laid out'] });
    unsubscribe();
  });
});
