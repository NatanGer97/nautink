import { describe, expect, it, vi } from 'vitest';

import { checkConnection, fetchHealth, toConnectionStatus } from './health.ts';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const codex = { isFound: true, version: '0.154.0', error: null };
const found = { claude: { isFound: true, version: '2.1.0', error: null }, codex };

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
    expect(toConnectionStatus(found, 'claude')).toEqual({ kind: 'connected', version: '2.1.0' });
    expect(
      toConnectionStatus(
        { claude: { isFound: false, version: null, error: 'ENOENT' }, codex },
        'claude',
      ),
    ).toEqual({ kind: 'disconnected', error: 'ENOENT' });
    expect(
      toConnectionStatus(
        { claude: { isFound: false, version: null, error: null }, codex },
        'claude',
      ),
    ).toEqual({
      kind: 'disconnected',
      error: 'Claude Code was not found.',
    });
  });
});

describe('toConnectionStatus for an agent', () => {
  it("reads the chosen agent's CLI", () => {
    expect(toConnectionStatus(found, 'codex')).toEqual({ kind: 'connected', version: '0.154.0' });
    const missing = { ...found, codex: { isFound: false, version: null, error: null } };
    expect(toConnectionStatus(missing, 'codex')).toEqual({
      kind: 'disconnected',
      error: 'Codex CLI was not found.',
    });
  });
});

describe('checkConnection', () => {
  it('reports an unreachable server as not connected, with the reason', async () => {
    const status = await checkConnection('claude', async () =>
      Promise.reject(new TypeError('Failed to fetch')),
    );
    expect(status).toEqual({
      kind: 'disconnected',
      error: 'Cannot reach the local server. Failed to fetch',
    });
  });

  it('reports a healthy server as connected', async () => {
    await expect(
      checkConnection('claude', async () => Promise.resolve(json(found))),
    ).resolves.toEqual({
      kind: 'connected',
      version: '2.1.0',
    });
  });
});
