import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildPrompt } from './prompt.ts';
import {
  makeTempDir,
  postJson,
  readError,
  readEvents,
  startTestServer,
} from '../../tests/test-server.ts';
import { buildCodexArgs } from '../agents/codex/codex-args.ts';

import type { TestServer } from '../../tests/test-server.ts';
import type { ChatEvent, ChatRequest } from '@nautink/contracts/chat';

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
  agent: 'codex',
  model: null,
  selection: null,
};

let scratch: string;
let recordPath: string;
let server: TestServer | undefined;

beforeAll(async () => {
  scratch = await makeTempDir('codex-chat');
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
  vi.stubEnv('FAKE_CODEX_SCENARIO', scenario);
  vi.stubEnv('FAKE_CODEX_RECORD', recordPath);
}

async function readRecord(): Promise<Recorded> {
  return JSON.parse(await readFile(recordPath, 'utf8')) as Recorded;
}

async function chat(url: string, request: Partial<ChatRequest> = {}): Promise<ChatEvent[]> {
  return readEvents(await postJson(`${url}/api/chat`, { ...REQUEST, ...request }));
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('POST /api/chat with agent codex', () => {
  it('streams a Codex reply as the same SSE events', async () => {
    useScenario('reply');
    const url = await start();
    const events = await chat(url);
    expect(events.slice(0, 2)).toEqual([
      { type: 'session', sessionId: 'fake-thread-1', model: 'default' },
      { type: 'delta', text: 'Here is the diagram.' },
    ]);
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      sessionId: 'fake-thread-1',
      text: 'Here is the diagram.',
      isError: false,
      costUsd: null,
    });
  });

  it('runs codex exec read-only in the work dir with the prompt on stdin', async () => {
    useScenario('reply');
    const url = await start();
    await chat(url);
    const recorded = await readRecord();
    expect(recorded.argv).toEqual(
      buildCodexArgs({ sessionId: null, model: null, isRepoAware: false }),
    );
    expect(recorded.argv).toContain('sandbox_mode="read-only"');
    expect(recorded.stdin).toBe(buildPrompt(REQUEST));
    expect(recorded.cwd).toBe(scratch);
  });

  it('resumes the session with the model, in the repo dir', async () => {
    useScenario('reply');
    const repoDir = await makeTempDir('codex-repo');
    const url = await start({ repoDir });
    await chat(url, { sessionId: 't-9', model: 'gpt-6-astra' });
    const recorded = await readRecord();
    expect(recorded.argv).toEqual(
      buildCodexArgs({ sessionId: 't-9', model: 'gpt-6-astra', isRepoAware: true }),
    );
    expect(recorded.cwd).toBe(repoDir);
  });

  it('reports shell steps and later messages as new turns', async () => {
    useScenario('tool');
    const url = await start();
    const events = await chat(url);
    expect(events.filter((event) => event.type === 'tool')).toEqual([
      { type: 'tool', label: 'Run rg login src' },
    ]);
    expect(events.filter((event) => event.type === 'turn')).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Done.' });
  });

  it('sends a failed turn as one error', async () => {
    useScenario('failed');
    const url = await start();
    const events = await chat(url);
    expect(events.filter((event) => event.type === 'error')).toEqual([
      { type: 'error', message: 'model not found' },
    ]);
    expect(events.at(-1)).toEqual({ type: 'error', message: 'model not found' });
  });

  it('sends stderr as an error when Codex crashes', async () => {
    useScenario('crash');
    const url = await start();
    expect(await chat(url)).toEqual([
      { type: 'error', message: 'Not logged in. Run codex login.' },
    ]);
  });

  it('kills Codex when the client disconnects', async () => {
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
    controller.abort();
    await vi.waitFor(
      () => {
        expect(isAlive(pid)).toBe(false);
      },
      { timeout: 5000, interval: 50 },
    );
  });

  it('rejects a session id that Codex would read as a flag, before running anything', async () => {
    useScenario('reply');
    const url = await start();
    const sessionId = '--dangerously-bypass-approvals-and-sandbox';
    const response = await postJson(`${url}/api/chat`, { ...REQUEST, sessionId });
    expect(response.status).toBe(400);
    expect(await readError(response)).toContain('sessionId');
    await expect(readRecord()).rejects.toThrow();
  });

  it('rejects a Claude model for Codex with a 400', async () => {
    const url = await start();
    const response = await postJson(`${url}/api/chat`, { ...REQUEST, model: 'opus' });
    expect(response.status).toBe(400);
    expect(await readError(response)).toBe(
      'Invalid request body: model: model "opus" does not belong to agent "codex"',
    );
  });
});
