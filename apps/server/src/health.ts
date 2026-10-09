import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { HealthResponse } from '@nautink/contracts/server-info';
import type { ExecFileException } from 'node:child_process';

const execFileAsync: (
  file: string,
  args: string[],
  options: { timeout: number; encoding: 'utf8' },
) => Promise<{ stdout: string; stderr: string }> = promisify(execFile);

export const HEALTH_TIMEOUT_MS: number = 5000;

const VERSION_PATTERN: RegExp = /\d+\.\d+\.\d+\S*/;

/** `2.1.0 (Claude Code)` → `2.1.0`; any other output is reported as its first line. */
export function parseVersion(output: string): string {
  const firstLine: string = output.trim().split('\n', 1).join('');
  return VERSION_PATTERN.exec(firstLine)?.[0] ?? firstLine;
}

function describeFailure(claudeBin: string, err: unknown): string {
  // `execFile` always rejects with an ExecFileException.
  const failure: ExecFileException = err as ExecFileException;
  if (failure.code === 'ENOENT') {
    return `"${claudeBin}" was not found. Install Claude Code or set CLAUDE_BIN.`;
  }
  if (failure.killed === true) {
    return `"${claudeBin} --version" did not answer in time.`;
  }
  return `"${claudeBin} --version" failed: ${failure.message}`;
}

/** Runs `<claudeBin> --version` without a shell. Never throws: a failure is part of the answer. */
export async function checkClaude(claudeBin: string, timeoutMs: number): Promise<HealthResponse> {
  try {
    const { stdout } = await execFileAsync(claudeBin, ['--version'], {
      timeout: timeoutMs,
      encoding: 'utf8',
    });
    return { claude: { isFound: true, version: parseVersion(stdout), error: null } };
  } catch (err) {
    return { claude: { isFound: false, version: null, error: describeFailure(claudeBin, err) } };
  }
}
