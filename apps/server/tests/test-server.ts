import { errorResponseSchema, healthResponseSchema } from '@nautink/contracts/server-info';
import { createChatStreamDecoder } from '@nautink/contracts/sse';
import { mkdtemp, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { createApp } from '../src/app.ts';
import { listen } from '../src/server.ts';

import type { AppOptions } from '../src/app.ts';
import type { ChatEvent } from '@nautink/contracts/chat';
import type { HealthResponse } from '@nautink/contracts/server-info';
import type { AddressInfo } from 'node:net';

/** The fake Claude Code CLI (see `fake-claude.ts`). */
export const FAKE_CLAUDE: string = path.join(import.meta.dirname, 'fake-claude.ts');

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

/** Starts the app on an ephemeral port with the fake CLI. */
export async function startTestServer(overrides: Partial<AppOptions> = {}): Promise<TestServer> {
  const app = createApp({
    claudeBin: FAKE_CLAUDE,
    repoDir: null,
    homeDir: os.tmpdir(),
    workDir: process.cwd(),
    healthTimeoutMs: 5000,
    ...overrides,
  });
  const server = await listen(app, 0);
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    close: async (): Promise<void> => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    },
  };
}

export async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Reads a whole SSE response into its events. */
export async function readEvents(response: Response): Promise<ChatEvent[]> {
  return createChatStreamDecoder().push(await response.text());
}

/** A fresh temp folder, with symlinks resolved (macOS's /var is /private/var). */
export async function makeTempDir(prefix: string): Promise<string> {
  return realpath(await mkdtemp(path.join(os.tmpdir(), `nautink-${prefix}-`)));
}

/** The `error` message of a JSON error response. */
export async function readError(response: Response): Promise<string> {
  return errorResponseSchema.parse(await response.json()).error;
}

/** `GET /api/health`, parsed. */
export async function fetchHealth(url: string): Promise<HealthResponse['claude']> {
  return healthResponseSchema.parse(await (await fetch(`${url}/api/health`)).json()).claude;
}
