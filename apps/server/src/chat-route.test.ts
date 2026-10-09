import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildClaudeArgs } from './claude-args.ts';
import { buildPrompt } from './prompt.ts';
import {
  makeTempDir,
  postJson,
  readError,
  readEvents,
  startTestServer,
} from '../tests/test-server.ts';

import type { TestServer } from '../tests/test-server.ts';
import type { ChatRequest } from '@nautink/contracts/chat';

interface Recorded {
  argv: string[];
  cwd: string;
  stdin: string;
  pid: number;
}

const REQUEST: ChatRequest = {
  message: 'Add a retry path',
  code: 'flowchart TD\n  a --> b',
  sessionId: null,
  model: null,
  selection: null,
};

let scratch: string;
let recordPath: string;
let server: TestServer | undefined;

beforeAll(async () => {
  scratch = await makeTempDir('chat');
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await server?.close();
  server = undefined;
});

async function start(overrides: Parameters<typeof startTestServer>[0] = {}): Promise<string> {
  server = await startTestServer({ workDir: scratch, ...overrides });
  return server.url;
}

function useScenario(scenario: string): void {
  recordPath = path.join(scratch, `record-${String(Math.random()).slice(2)}.json`);
  vi.stubEnv('FAKE_CLAUDE_SCENARIO', scenario);
  vi.stubEnv('FAKE_CLAUDE_RECORD', recordPath);
}

async function readRecord(): Promise<Recorded> {
  return JSON.parse(await readFile(recordPath, 'utf8')) as Recorded;
}

async function chat(url: string, request: Partial<ChatRequest> = {}): Promise<Response> {
  return postJson(`${url}/api/chat`, { ...REQUEST, ...request });
}

describe('POST /api/chat', () => {
  it('streams a reply as SSE events', async () => {
    useScenario('reply');
    const url = await start();
    const response = await chat(url);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(await readEvents(response)).toEqual([
      { type: 'session', sessionId: 'fake-session-1', model: 'fake-model' },
      { type: 'turn' },
      { type: 'delta', text: 'Here is ' },
      { type: 'delta', text: 'the diagram.' },
      {
        type: 'done',
        sessionId: 'fake-session-1',
        text: 'Here is the diagram.',
        isError: false,
        durationMs: 42,
        costUsd: 0.01,
      },
    ]);
  });

  it('spawns the CLI with the lean flags, the prompt on stdin and the work dir as cwd', async () => {
    useScenario('reply');
    const url = await start();
    await readEvents(await chat(url));
    const recorded = await readRecord();
    expect(recorded.argv).toEqual(
      buildClaudeArgs({ sessionId: null, model: null, isRepoAware: false }),
    );
    expect(recorded.argv).toContain('--tools');
    expect(recorded.argv[recorded.argv.indexOf('--tools') + 1]).toBe('');
    expect(recorded.stdin).toBe(buildPrompt(REQUEST));
    expect(recorded.cwd).toBe(scratch);
  });

  it('passes model, session and selection, and runs in the repo dir with read-only tools', async () => {
    useScenario('reply');
    const repoDir = await makeTempDir('repo');
    const url = await start({ repoDir });
    const request: Partial<ChatRequest> = {
      sessionId: 'abc',
      model: 'haiku',
      selection: { ids: ['a'], labels: ['Start'] },
    };
    await readEvents(await chat(url, request));
    const recorded = await readRecord();
    expect(recorded.argv).toEqual(
      buildClaudeArgs({ sessionId: 'abc', model: 'haiku', isRepoAware: true }),
    );
    expect(recorded.argv).toContain('Read,Grep,Glob');
    expect(recorded.cwd).toBe(repoDir);
    expect(recorded.stdin).toContain('Selected nodes (id: label):\n- a: "Start"');
    expect(recorded.stdin).toContain('Limit your changes to these nodes and their direct links');
  });

  it('reports tool steps and turns', async () => {
    useScenario('tool');
    const url = await start();
    const events = await readEvents(await chat(url));
    expect(events.filter((event) => event.type === 'tool')).toEqual([
      { type: 'tool', label: 'Read src/auth.ts' },
      { type: 'tool', label: 'Grep login' },
      { type: 'tool', label: 'Glob' },
    ]);
    expect(events.filter((event) => event.type === 'turn')).toHaveLength(2);
    expect(events.at(-1)?.type).toBe('done');
  });

  it('joins stdout lines split across chunks and skips noise', async () => {
    useScenario('partial');
    const url = await start();
    const events = await readEvents(await chat(url));
    expect(events.map((event) => event.type)).toEqual(['session', 'delta', 'done']);
    expect(events[1]).toEqual({ type: 'delta', text: 'split across chunks' });
  });

  it('passes an error result through as done with isError', async () => {
    useScenario('error-result');
    const url = await start();
    const events = await readEvents(await chat(url));
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      isError: true,
      text: 'The model is overloaded.',
    });
  });

  it('sends stderr as an error when the CLI fails without a result', async () => {
    useScenario('crash');
    const url = await start();
    const events = await readEvents(await chat(url));
    expect(events).toEqual([{ type: 'error', message: 'Invalid API key · Please run /login' }]);
  });

  it('sends the exit code when the CLI fails silently', async () => {
    useScenario('silent-exit');
    const url = await start();
    expect(await readEvents(await chat(url))).toEqual([
      { type: 'error', message: 'claude exited with code 3' },
    ]);
  });

  it('survives a CLI that exits without reading a prompt larger than the pipe buffer', async () => {
    useScenario('silent-exit');
    const url = await start();
    // ~260 KB: far over the 64 KB pipe buffer, so writing stdin always breaks the pipe, and well
    // under the 2 MB body limit.
    const response = await chat(url, { code: 'flowchart TD\n'.repeat(20_000) });
    expect(response.status).toBe(200);
    expect(await readEvents(response)).toEqual([
      { type: 'error', message: 'claude exited with code 3' },
    ]);
  });

  it('sends an error when the CLI cannot start', async () => {
    const url = await start({ claudeBin: path.join(scratch, 'no-such-claude') });
    const events = await readEvents(await chat(url));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'error' });
    expect(events[0]?.type === 'error' && events[0].message).toContain(
      `Failed to start "${path.join(scratch, 'no-such-claude')}"`,
    );
  });

  it('kills the CLI when the client disconnects', async () => {
    useScenario('hang');
    const url = await start();
    const controller = new AbortController();
    const response = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(REQUEST),
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    const { pid } = await vi.waitFor(readRecord, { timeout: 5000, interval: 50 });
    expect(isAlive(pid)).toBe(true);
    controller.abort();
    await vi.waitFor(
      () => {
        expect(isAlive(pid)).toBe(false);
      },
      { timeout: 5000, interval: 50 },
    );
  });

  it('rejects an invalid body with a 400 naming the fields', async () => {
    const url = await start();
    const blank = await chat(url, { message: '  ' });
    expect(blank.status).toBe(400);
    expect(await blank.json()).toEqual({
      error: 'Invalid request body: message: message is required',
    });
    const badModel = await postJson(`${url}/api/chat`, { ...REQUEST, model: 'gpt-5' });
    expect(await readError(badModel)).toContain('model: ');
    const noBody = await fetch(`${url}/api/chat`, { method: 'POST' });
    expect(noBody.status).toBe(400);
    expect(await readError(noBody)).toMatch(/^Invalid request body: /);
  });
});

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
