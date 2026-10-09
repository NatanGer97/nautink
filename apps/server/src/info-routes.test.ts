import { mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  fetchHealth,
  makeTempDir,
  postJson,
  readError,
  startTestServer,
} from '../tests/test-server.ts';

import type { TestServer } from '../tests/test-server.ts';

let home: string;
let outside: string;
let server: TestServer | undefined;

beforeAll(async () => {
  home = await makeTempDir('home');
  outside = await makeTempDir('outside');
  await mkdir(path.join(home, 'dev', 'app'), { recursive: true });
  await writeFile(path.join(home, 'notes.txt'), 'x');
  await symlink(outside, path.join(home, 'escape'));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await server?.close();
  server = undefined;
});

async function start(overrides: Parameters<typeof startTestServer>[0] = {}): Promise<string> {
  server = await startTestServer({ homeDir: home, ...overrides });
  return server.url;
}

describe('GET /api/info', () => {
  it('reports the startup repo dir', async () => {
    const url = await start({ repoDir: '/somewhere' });
    const response = await fetch(`${url}/api/info`);
    expect(await response.json()).toEqual({ repoDir: '/somewhere' });
  });
});

describe('GET /api/health', () => {
  it('reports the CLI version', async () => {
    const url = await start();
    const response = await fetch(`${url}/api/health`);
    expect(await response.json()).toEqual({
      claude: { isFound: true, version: '2.1.0', error: null },
    });
  });

  it('reports a missing CLI', async () => {
    const url = await start({ claudeBin: path.join(home, 'no-such-claude') });
    const health = await fetchHealth(url);
    expect(health.isFound).toBe(false);
    expect(health.version).toBeNull();
    expect(health.error).toContain('was not found');
  });

  it('reports a failing CLI and a CLI that does not answer', async () => {
    const url = await start({ healthTimeoutMs: 300 });
    vi.stubEnv('FAKE_CLAUDE_SCENARIO', 'version-fail');
    const failed = await fetchHealth(url);
    expect(failed.error).toContain('--version" failed');
    vi.stubEnv('FAKE_CLAUDE_SCENARIO', 'hang');
    const hung = await fetchHealth(url);
    expect(hung).toEqual({
      isFound: false,
      version: null,
      error: expect.stringContaining('did not answer in time') as unknown,
    });
  });
});

describe('POST /api/repo', () => {
  it('sets a folder inside home, expanding ~, and turns it off with null', async () => {
    const url = await start();
    const chosen = await postJson(`${url}/api/repo`, { path: '~/dev/app' });
    expect(chosen.status).toBe(200);
    expect(await chosen.json()).toEqual({ repoDir: path.join(home, 'dev', 'app') });
    expect(await (await fetch(`${url}/api/info`)).json()).toEqual({
      repoDir: path.join(home, 'dev', 'app'),
    });
    const cleared = await postJson(`${url}/api/repo`, { path: null });
    expect(await cleared.json()).toEqual({ repoDir: null });
  });

  it('accepts an absolute path inside home', async () => {
    const url = await start();
    const response = await postJson(`${url}/api/repo`, { path: path.join(home, 'dev') });
    expect(await response.json()).toEqual({ repoDir: path.join(home, 'dev') });
  });

  it.each([
    ['the home folder itself', '~', 'must be inside your home folder'],
    ['a folder outside home', 'OUTSIDE', 'must be inside your home folder'],
    ['a symlink that leads outside home', '~/escape', 'must be inside your home folder'],
    ['a parent escape', '~/dev/../../', 'must be inside your home folder'],
    ['a missing folder', '~/missing', 'Folder not found'],
    ['a file', '~/notes.txt', 'Not a folder'],
    ['a relative path', 'dev/app', 'absolute path'],
  ])('rejects %s', async (...[, input, message]) => {
    const url = await start({ repoDir: '/before' });
    const response = await postJson(`${url}/api/repo`, {
      path: input === 'OUTSIDE' ? outside : input,
    });
    expect(response.status).toBe(400);
    expect(await readError(response)).toContain(message);
    expect(await (await fetch(`${url}/api/info`)).json()).toEqual({ repoDir: '/before' });
  });

  it('answers 500 when the home folder itself cannot be read', async () => {
    const url = await start({ homeDir: path.join(home, 'gone') });
    const response = await postJson(`${url}/api/repo`, { path: path.join(home, 'dev') });
    expect(response.status).toBe(500);
  });

  it('rejects an invalid body', async () => {
    const url = await start();
    for (const body of [{}, { path: '' }, { path: 3 }]) {
      const response = await postJson(`${url}/api/repo`, body);
      expect(response.status).toBe(400);
      expect(await readError(response)).toMatch(/^Invalid request body: path: /);
    }
    const notAnObject = await postJson(`${url}/api/repo`, [1]);
    expect(await readError(notAnObject)).toBe(
      'Invalid request body: Invalid input: expected object, received array',
    );
  });
});

describe('API errors', () => {
  it('answers malformed JSON with a JSON 400', async () => {
    const url = await start();
    const response = await fetch(`${url}/api/repo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"path":',
    });
    expect(response.status).toBe(400);
    expect(await readError(response)).toMatch(/^Invalid request body: /);
  });

  it('answers an oversized body with a JSON 413', async () => {
    const url = await start();
    const response = await postJson(`${url}/api/repo`, { path: 'x'.repeat(3 * 1024 * 1024) });
    expect(response.status).toBe(413);
    expect(await readError(response)).toMatch(/^Invalid request body: /);
  });

  it('answers an unknown API route with a JSON 404', async () => {
    const url = await start();
    const response = await fetch(`${url}/api/nope?x=1`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found: GET /api/nope?x=1' });
  });
});
