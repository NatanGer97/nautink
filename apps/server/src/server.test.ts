import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.ts';
import { createProcessLogger } from './logger.ts';
import { HOST, listen, startServer } from './server.ts';
import { FAKE_CLAUDE, makeTempDir } from '../tests/test-server.ts';

import type { Logger } from './logger.ts';
import type { ChildProcess } from 'node:child_process';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const servers: { close: () => unknown }[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) {
    server.close();
  }
  vi.restoreAllMocks();
});

function createMemoryLogger(): Logger & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    info: (message) => lines.push(`info: ${message}`),
    error: (message) => lines.push(`error: ${message}`),
  };
}

async function occupyPort(): Promise<number> {
  const blocker = createServer();
  servers.push(blocker);
  await new Promise<void>((resolve) => {
    blocker.listen(0, HOST, resolve);
  });
  return (blocker.address() as AddressInfo).port;
}

describe('startServer', () => {
  it('listens on 127.0.0.1 and logs the URL and repo dir', async () => {
    const home = await makeTempDir('start-home');
    const logger = createMemoryLogger();
    const env = { API_PORT: '0', CLAUDE_BIN: FAKE_CLAUDE, REPO_DIR: home };
    const server: Server = await startServer({ env, homeDir: home, logger });
    servers.push(server);
    const { address, port } = server.address() as AddressInfo;
    expect(address).toBe('127.0.0.1');
    expect(logger.lines).toEqual([
      `info: Nautink server on http://127.0.0.1:${String(port)}`,
      `info: Repo-aware mode: ${home}`,
    ]);
    const info = await (await fetch(`http://127.0.0.1:${String(port)}/api/info`)).json();
    expect(info).toEqual({ repoDir: home });
  });

  it('throws on invalid config', async () => {
    const logger = createMemoryLogger();
    await expect(startServer({ env: { API_PORT: 'x' }, homeDir: '/', logger })).rejects.toThrow(
      'API_PORT must be a whole number',
    );
  });

  it('explains a taken port', async () => {
    const port = await occupyPort();
    const env = { API_PORT: String(port) };
    await expect(startServer({ env, homeDir: '/', logger: createMemoryLogger() })).rejects.toThrow(
      `Port ${String(port)} on 127.0.0.1 is already in use. Set API_PORT to use another port.`,
    );
  });
});

describe('listen', () => {
  it('reports other listen errors', async () => {
    const app = createApp({
      claudeBin: FAKE_CLAUDE,
      repoDir: null,
      homeDir: '/',
      healthTimeoutMs: 1000,
    });
    await expect(listen(app, 70_000)).rejects.toThrow(/^Cannot listen on 127\.0\.0\.1:70000: /);
  });
});

describe('createProcessLogger', () => {
  it('writes info to stdout and errors to stderr', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const logger = createProcessLogger();
    logger.info('hello');
    logger.error('oops');
    expect(stdout).toHaveBeenCalledWith('hello\n');
    expect(stderr).toHaveBeenCalledWith('oops\n');
  });
});

describe('main.ts under plain Node (type stripping)', () => {
  function runMain(env: Record<string, string>): ChildProcess {
    return spawn(process.execPath, [path.join(import.meta.dirname, 'main.ts')], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  async function collect(child: ChildProcess, pattern: RegExp): Promise<RegExpMatchArray> {
    let output = '';
    return new Promise((resolve, reject) => {
      const onData = (chunk: Buffer): void => {
        output += chunk.toString();
        const match = pattern.exec(output);
        if (match) {
          resolve(match);
        }
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      child.on('exit', () => {
        reject(new Error(`main.ts exited before printing ${String(pattern)}:\n${output}`));
      });
    });
  }

  it('starts, answers the API with the contracts package, and runs the fake CLI', async () => {
    const child = runMain({ API_PORT: '0', CLAUDE_BIN: FAKE_CLAUDE });
    servers.push({ close: () => child.kill() });
    const [, url] = await collect(child, /Nautink server on (http:\S+)/);
    const health = await (await fetch(`${url!}/api/health`)).json();
    expect(health).toEqual({ claude: { isFound: true, version: '2.1.0', error: null } });
  });

  it('exits with code 1 and a message on invalid config', async () => {
    const child = runMain({ API_PORT: '-1' });
    const exitCode = await new Promise<number | null>((resolve) => {
      child.on('exit', resolve);
    });
    expect(exitCode).toBe(1);
  });
});
