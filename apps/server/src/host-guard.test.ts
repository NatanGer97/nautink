import { existsSync } from 'node:fs';
import { request } from 'node:http';
import os from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hostnameOf } from './host-guard.ts';
import { prepareNeutralWorkDir } from './server.ts';
import { startTestServer } from '../tests/test-server.ts';

import type { TestServer } from '../tests/test-server.ts';

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

/** `fetch` cannot set the Host header, so this goes through `node:http`. */
async function statusFor(host: string): Promise<{ status: number; body: string }> {
  const url = new URL('/api/info', server.url);
  return new Promise((resolve, reject) => {
    const req = request(url, { headers: { host } }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => (body += chunk.toString()));
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('hostnameOf', () => {
  it('strips the port and lower-cases', () => {
    expect(hostnameOf('LocalHost:8791')).toBe('localhost');
    expect(hostnameOf('127.0.0.1')).toBe('127.0.0.1');
    expect(hostnameOf('[::1]:8791')).toBe('[::1]');
    expect(hostnameOf(undefined)).toBe('');
  });
});

describe('guardHost', () => {
  it('lets local host names through', async () => {
    for (const host of ['localhost:5190', '127.0.0.1:8791', '[::1]:8791']) {
      expect((await statusFor(host)).status).toBe(200);
    }
  });

  it('refuses any other host with a JSON error', async () => {
    const result = await statusFor('attacker.example:8791');
    expect(result.status).toBe(403);
    expect(JSON.parse(result.body)).toEqual({
      error: 'Requests must be addressed to localhost or 127.0.0.1.',
    });
  });
});

describe('prepareNeutralWorkDir', () => {
  it('returns an existing folder under the system temp dir', () => {
    const workDir = prepareNeutralWorkDir();
    expect(workDir.startsWith(os.tmpdir())).toBe(true);
    expect(existsSync(workDir)).toBe(true);
  });
});
