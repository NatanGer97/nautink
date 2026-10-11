import { chmod, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { beforeAll, describe, expect, it } from 'vitest';

import { startCliRun } from './cli-run.ts';
import { makeTempDir } from '../../tests/test-server.ts';

import type { ChatEvent } from '@nautink/contracts/chat';

let scratch: string;

beforeAll(async () => {
  scratch = await makeTempDir('cli-run');
});

/** Writes an executable shell script called `name` and returns its path. */
async function script(name: string, body: string): Promise<string> {
  const file: string = path.join(scratch, name);
  await writeFile(file, `#!/bin/sh\n${body}\n`);
  await chmod(file, 0o755);
  return file;
}

const DONE: ChatEvent = {
  type: 'done',
  sessionId: 's1',
  text: 'b',
  isError: false,
  durationMs: 0,
  costUsd: null,
};

function toEvents(line: string): ChatEvent[] {
  if (line === 'b') {
    return [DONE];
  }
  if (line === 'fail') {
    return [{ type: 'error', message: 'the turn failed' }];
  }
  return line === '' ? [] : [{ type: 'delta', text: line }];
}

async function run(bin: string, name = 'fake'): Promise<{ events: ChatEvent[]; ends: number }> {
  // One object, so a test can look again after more output arrives.
  const state: { events: ChatEvent[]; ends: number } = { events: [], ends: 0 };
  await new Promise<void>((resolve) => {
    startCliRun({
      name,
      bin,
      args: [],
      cwd: scratch,
      prompt: 'hi',
      parseLine: toEvents,
      emit: (event: ChatEvent) => {
        state.events.push(event);
      },
      onEnd: () => {
        state.ends += 1;
        resolve();
      },
    });
  });
  return state;
}

describe('startCliRun', () => {
  it('turns each stdout line into events with the given parser', async () => {
    const bin: string = await script('two-lines', 'cat > /dev/null; echo a; echo b');
    expect(await run(bin)).toEqual({ events: [{ type: 'delta', text: 'a' }, DONE], ends: 1 });
  });

  it('names the CLI when it exits without a result', async () => {
    const bin: string = await script('silent', 'cat > /dev/null; exit 2');
    expect((await run(bin, 'codex')).events).toEqual([
      { type: 'error', message: 'codex exited with code 2' },
    ]);
  });

  it('ends on an error event from the parser, ignoring later output and the exit', async () => {
    const bin: string = await script(
      'failing',
      'cat > /dev/null; echo fail; sleep 0.1; echo late; exit 1',
    );
    const result = await run(bin);
    // Give the late line and the exit time to arrive: neither may add an event or a second end.
    await sleep(400);
    expect(result).toEqual({ events: [{ type: 'error', message: 'the turn failed' }], ends: 1 });
  });
});
