import { describe, expect, it, vi } from 'vitest';

import { checkConnection, fetchHealth, toConnectionStatus } from './health.ts';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const found = { claude: { isFound: true, version: '2.1.0', error: null } };

describe('fetchHealth', () => {
  it('returns the validated health answer', async () => {
    const fetchImpl = vi.fn(async () => Promise.resolve(json(found)));
    await expect(fetchHealth(fetchImpl)).resolves.toEqual(found);
    expect(fetchImpl).toHaveBeenCalledWith('/api/health', expect.anything());
  });

  it('throws on an HTTP error, naming the status', async () => {
    await expect(
      fetchHealth(async () => Promise.resolve(json({ error: 'down' }, 502))),
    ).rejects.toThrow('502');
  });

  it('throws on an answer that does not match the contract', async () => {
    await expect(
      fetchHealth(async () => Promise.resolve(json({ claude: { isFound: 'yes' } }))),
    ).rejects.toThrow();
  });
});

describe('toConnectionStatus', () => {
  it('maps found and missing CLIs', () => {
    expect(toConnectionStatus(found)).toEqual({ kind: 'connected', version: '2.1.0' });
    expect(
      toConnectionStatus({ claude: { isFound: false, version: null, error: 'ENOENT' } }),
    ).toEqual({ kind: 'disconnected', error: 'ENOENT' });
    expect(toConnectionStatus({ claude: { isFound: false, version: null, error: null } })).toEqual({
      kind: 'disconnected',
      error: 'Claude Code was not found.',
    });
  });
});

describe('checkConnection', () => {
  it('reports an unreachable server as not connected, with the reason', async () => {
    const status = await checkConnection(async () =>
      Promise.reject(new TypeError('Failed to fetch')),
    );
    expect(status).toEqual({
      kind: 'disconnected',
      error: 'Cannot reach the local server. Failed to fetch',
    });
  });

  it('reports a healthy server as connected', async () => {
    await expect(checkConnection(async () => Promise.resolve(json(found)))).resolves.toEqual({
      kind: 'connected',
      version: '2.1.0',
    });
  });
});
