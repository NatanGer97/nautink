import type { SpawnOptions } from 'node:child_process';
import type { EventEmitter } from 'node:events';

type BrowserProcess = EventEmitter & { unref: () => void };

/** The part of `child_process.spawn` the opener needs, so tests can pass a fake. */
export type SpawnBrowser = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => BrowserProcess;

export interface BrowserCommand {
  command: string;
  args: string[];
}

/** The command that opens a URL in the default browser on this platform. */
export function browserCommand(platform: NodeJS.Platform, url: string): BrowserCommand {
  if (platform === 'darwin') {
    return { command: 'open', args: [url] };
  }
  if (platform === 'win32') {
    // `start` treats its first quoted argument as the window title, so pass an empty one.
    return { command: 'cmd', args: ['/c', 'start', '""', url] };
  }
  return { command: 'xdg-open', args: [url] };
}

/**
 * Opens the URL in the default browser. Never throws: with no browser (SSH, a container) it resolves
 * to a hint for the user instead, and `null` once the opener started.
 */
export async function openBrowser(
  url: string,
  platform: NodeJS.Platform,
  spawn: SpawnBrowser,
): Promise<string | null> {
  const { command, args } = browserCommand(platform, url);
  const child: BrowserProcess = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
  return new Promise((resolve) => {
    child.once('spawn', () => {
      resolve(null);
    });
    child.once('error', (err: Error) => {
      resolve(`Could not open a browser (${err.message}). Open ${url} yourself.`);
    });
  });
}
