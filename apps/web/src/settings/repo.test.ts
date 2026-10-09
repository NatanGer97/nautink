import { describe, expect, it, vi } from 'vitest';

import { fetchRepoDir, folderName, saveRepoDir } from './repo.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('fetchRepoDir', () => {
  it('reads the folder from /api/info', async () => {
    const fetchImpl = vi.fn(async (...args: [string, RequestInit?]) =>
      Promise.resolve(json({ repoDir: args[0] === '/api/info' ? '/code/app' : null })),
    );
    expect(await fetchRepoDir(fetchImpl)).toBe('/code/app');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/api/info');
    expect(await fetchRepoDir(async () => Promise.resolve(json({ repoDir: null })))).toBeNull();
  });

  it('throws for a failed or malformed answer', async () => {
    await expect(fetchRepoDir(async () => Promise.resolve(json({}, 500)))).rejects.toThrow(
      'The server answered 500 for /api/info.',
    );
    await expect(fetchRepoDir(async () => Promise.resolve(json({ nope: 1 })))).rejects.toThrow();
  });
});

describe('saveRepoDir', () => {
  it('posts the trimmed path, or null to clear it', async () => {
    const fetchImpl = vi.fn(async (...[, init]: [string, RequestInit?]) =>
      Promise.resolve(
        json({ repoDir: (JSON.parse(init?.body as string) as { path: string | null }).path }),
      ),
    );
    expect(await saveRepoDir('  /code/app ', fetchImpl)).toBe('/code/app');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/api/repo');
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(await saveRepoDir(null, fetchImpl)).toBeNull();
  });

  it('refuses a blank path and throws the server error', async () => {
    await expect(saveRepoDir('   ', vi.fn())).rejects.toThrow('Enter the path of a folder.');
    const missing = json({ error: 'Not a folder: /nope' }, 400);
    await expect(saveRepoDir('/nope', async () => Promise.resolve(missing))).rejects.toThrow(
      'Not a folder: /nope',
    );
    const html = new Response('<html>', { status: 502 });
    await expect(saveRepoDir('/x', async () => Promise.resolve(html))).rejects.toThrow(
      'The server answered 502 for /api/repo.',
    );
  });
});

describe('folderName', () => {
  it('takes the last folder of a POSIX or Windows path', () => {
    expect(folderName('/Users/me/code/app/')).toBe('app');
    expect(folderName('C:\\work\\api')).toBe('api');
    expect(folderName('/')).toBe('/');
  });
});
