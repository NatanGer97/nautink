import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import type { Stats } from 'node:fs';

/** A codebase folder the server refuses to let Claude read. The message names the path. */
export class InvalidRepoDirError extends Error {
  override name: string = 'InvalidRepoDirError';
}

/** Replaces a leading `~` with the home directory: `~` and `~/dev/app`, not `~user`. */
export function expandHome(input: string, homeDir: string): string {
  if (input === '~') {
    return homeDir;
  }
  return input.startsWith('~/') ? path.join(homeDir, input.slice('~/'.length)) : input;
}

function isStrictlyInside(child: string, parent: string): boolean {
  const relative: string = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function realDirectory(target: string): Promise<string> {
  let resolved: string;
  try {
    resolved = await realpath(target);
  } catch {
    throw new InvalidRepoDirError(`Folder not found: ${target}`);
  }
  const stats: Stats = await stat(resolved);
  if (!stats.isDirectory()) {
    throw new InvalidRepoDirError(`Not a folder: ${target}`);
  }
  return resolved;
}

/**
 * Resolves the folder chosen for repo-aware mode (PRD §7.4). It must be an absolute path (or start
 * with `~`), exist, be a directory, and resolve — symlinks followed — strictly inside the home
 * directory. The home directory itself is refused: it holds keys and tokens Claude must not read.
 */
export async function resolveRepoDir(input: string, homeDir: string): Promise<string> {
  const expanded: string = expandHome(input, homeDir);
  if (!path.isAbsolute(expanded)) {
    throw new InvalidRepoDirError(`Use an absolute path or one starting with ~: ${input}`);
  }
  const resolved: string = await realDirectory(expanded);
  const realHome: string = await realpath(homeDir);
  if (!isStrictlyInside(resolved, realHome)) {
    throw new InvalidRepoDirError(
      `The folder must be inside your home folder (${realHome}): ${input}`,
    );
  }
  return resolved;
}
