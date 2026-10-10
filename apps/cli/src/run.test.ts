import { describe, expect, it, vi } from 'vitest';

import { HELP_TEXT } from './args.ts';
import { run } from './run.ts';

import type { RunDeps } from './run.ts';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const PORT: number = 8791;

function makeDeps(overrides: Partial<RunDeps> = {}): RunDeps & { lines: string[] } {
  const lines: string[] = [];
  const address: AddressInfo = { address: '127.0.0.1', family: 'IPv4', port: PORT };
  const server = { address: (): AddressInfo => address };
  return {
    lines,
    env: { CLAUDE_BIN: 'my-claude' },
    homeDir: '/home/me',
    platform: 'darwin',
    version: '0.1.0',
    webDistDir: '/pkg/dist/web',
    logger: {
      info: (message: string) => lines.push(`info: ${message}`),
      error: (message: string) => lines.push(`error: ${message}`),
    },
    startServer: vi.fn(async () => Promise.resolve(server as unknown as Server)),
    openBrowser: vi.fn(async () => Promise.resolve(null)),
    ...overrides,
  };
}

describe('run', () => {
  it('starts the server with the shipped web app, prints the URL and opens it', async () => {
    const deps = makeDeps();
    await expect(run([], deps)).resolves.toBe(0);
    const options = vi.mocked(deps.startServer).mock.calls[0]![0];
    expect(options.env).toEqual({ CLAUDE_BIN: 'my-claude' });
    expect(options.homeDir).toBe('/home/me');
    expect(options.webDistDir).toBe('/pkg/dist/web');
    expect(deps.lines).toContain(`info: Nautink is running at http://127.0.0.1:${String(PORT)}`);
    expect(deps.openBrowser).toHaveBeenCalledWith(`http://127.0.0.1:${String(PORT)}`, 'darwin');
  });

  it('passes --port to the server as API_PORT and skips the browser with --no-open', async () => {
    const deps = makeDeps();
    await expect(run(['--port', '9000', '--no-open'], deps)).resolves.toBe(0);
    const options = vi.mocked(deps.startServer).mock.calls[0]![0];
    expect(options.env).toEqual({ CLAUDE_BIN: 'my-claude', API_PORT: '9000' });
    expect(deps.openBrowser).not.toHaveBeenCalled();
  });

  it('prints the hint when no browser could be opened', async () => {
    const hint = 'Could not open a browser (ENOENT). Open http://127.0.0.1:8791 yourself.';
    const deps = makeDeps({ openBrowser: vi.fn(async () => Promise.resolve(hint)) });
    await expect(run([], deps)).resolves.toBe(0);
    expect(deps.lines).toContain(`error: ${hint}`);
  });

  it('prints help or the version without starting anything', async () => {
    const deps = makeDeps();
    await expect(run(['--help'], deps)).resolves.toBe(0);
    await expect(run(['--version'], deps)).resolves.toBe(0);
    expect(deps.lines).toEqual([`info: ${HELP_TEXT}`, 'info: 0.1.0']);
    expect(deps.startServer).not.toHaveBeenCalled();
  });

  it('exits 1 with the message on bad arguments', async () => {
    const deps = makeDeps();
    await expect(run(['--prot'], deps)).resolves.toBe(1);
    expect(deps.lines).toEqual([
      "error: Unknown option '--prot'. Run nautink --help to see the options.",
    ]);
  });

  it('exits 1 with the message when the server cannot start', async () => {
    const failure = new Error('Port 8791 on 127.0.0.1 is already in use.');
    const deps = makeDeps({ startServer: vi.fn(async () => Promise.reject(failure)) });
    await expect(run([], deps)).resolves.toBe(1);
    expect(deps.lines).toEqual([`error: ${failure.message}`]);
  });

  it('exits 1 with the thrown value when it is not an Error', async () => {
    const deps = makeDeps({ startServer: vi.fn().mockRejectedValue('boom') });
    await expect(run([], deps)).resolves.toBe(1);
    expect(deps.lines).toEqual(['error: boom']);
  });
});
