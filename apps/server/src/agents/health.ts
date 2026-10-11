import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { CliStatus } from '@nautink/contracts/server-info';
import type { ExecFileException } from 'node:child_process';

const execFileAsync: (
  file: string,
  args: string[],
  options: { timeout: number; encoding: 'utf8' },
) => Promise<{ stdout: string; stderr: string }> = promisify(execFile);

export const HEALTH_TIMEOUT_MS: number = 5000;

const VERSION_PATTERN: RegExp = /\d+\.\d+\.\d+\S*/;

/** One agent CLI to check: its command, its name, and the variable that sets the command. */
export interface CliToCheck {
  bin: string;
  cliName: string;
  envVar: string;
}

/** `2.1.0 (Claude Code)` → `2.1.0`; any other output is reported as its first line. */
export function parseVersion(output: string): string {
  const firstLine: string = output.trim().split('\n', 1).join('');
  return VERSION_PATTERN.exec(firstLine)?.[0] ?? firstLine;
}

function describeFailure({ bin, cliName, envVar }: CliToCheck, err: unknown): string {
  // `execFile` always rejects with an ExecFileException.
  const failure: ExecFileException = err as ExecFileException;
  if (failure.code === 'ENOENT') {
    return `"${bin}" was not found. Install ${cliName} or set ${envVar}.`;
  }
  if (failure.killed === true) {
    return `"${bin} --version" did not answer in time.`;
  }
  return `"${bin} --version" failed: ${failure.message}`;
}

/** Runs `<bin> --version` without a shell. Never throws: a failure is part of the answer. */
export async function checkCli(cli: CliToCheck, timeoutMs: number): Promise<CliStatus> {
  try {
    const { stdout } = await execFileAsync(cli.bin, ['--version'], {
      timeout: timeoutMs,
      encoding: 'utf8',
    });
    return { isFound: true, version: parseVersion(stdout), error: null };
  } catch (err) {
    return { isFound: false, version: null, error: describeFailure(cli, err) };
  }
}
