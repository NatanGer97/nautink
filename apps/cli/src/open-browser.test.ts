import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { browserCommand, openBrowser } from './open-browser.ts';

import type { SpawnBrowser } from './open-browser.ts';

const URL: string = 'http://127.0.0.1:8791';

function fakeSpawn(event: 'spawn' | 'error'): SpawnBrowser & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const spawn = (command: string, args: string[], options: object): EventEmitter => {
    calls.push([command, args, options]);
    const child = Object.assign(new EventEmitter(), { unref: vi.fn() });
    queueMicrotask(() => {
      child.emit(event, new Error('spawn xdg-open ENOENT'));
    });
    return child;
  };
  return Object.assign(spawn, { calls }) as SpawnBrowser & { calls: unknown[][] };
}

describe('browserCommand', () => {
  it('uses the platform opener', () => {
    expect(browserCommand('darwin', URL)).toEqual({ command: 'open', args: [URL] });
    expect(browserCommand('linux', URL)).toEqual({ command: 'xdg-open', args: [URL] });
    expect(browserCommand('win32', URL)).toEqual({
      command: 'cmd',
      args: ['/c', 'start', '""', URL],
    });
  });
});

describe('openBrowser', () => {
  it('starts the opener detached and reports success', async () => {
    const spawn = fakeSpawn('spawn');
    await expect(openBrowser(URL, 'darwin', spawn)).resolves.toBeNull();
    expect(spawn.calls).toEqual([['open', [URL], { detached: true, stdio: 'ignore' }]]);
  });

  it('returns a hint instead of throwing when no browser can be opened', async () => {
    const spawn = fakeSpawn('error');
    await expect(openBrowser(URL, 'linux', spawn)).resolves.toBe(
      `Could not open a browser (spawn xdg-open ENOENT). Open ${URL} yourself.`,
    );
  });
});
