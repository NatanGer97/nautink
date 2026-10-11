#!/usr/bin/env node
/**
 * Proves the `nautink` package works the way users get it: packs `apps/cli` (built first with
 * `pnpm --filter nautink build`), installs the tarball into an empty folder with npm, runs the
 * installed `nautink` command and checks it serves the web app and the API. Nothing from the
 * workspace is reachable there, and Node will not strip types inside `node_modules`, so a missing
 * file, dependency or bundled module fails here.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import type { ChildProcess, SpawnSyncReturns } from 'node:child_process';

const CLI_DIR: string = path.join(import.meta.dirname, '..', 'apps', 'cli');
const START_TIMEOUT_MS: number = 15_000;
const URL_PATTERN: RegExp = /Nautink is running at (http:\/\/\S+)/;

function runOrThrow(command: string, args: string[], cwd: string): void {
  const result: SpawnSyncReturns<string> = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stdout}${result.stderr}`);
  }
}

function packAndInstall(workDir: string): string {
  if (!existsSync(path.join(CLI_DIR, 'dist', 'cli.js'))) {
    throw new Error('apps/cli is not built. Run pnpm --filter nautink build first.');
  }
  runOrThrow('pnpm', ['pack', '--pack-destination', workDir], CLI_DIR);
  const tarball: string | undefined = readdirSync(workDir).find((name) => name.endsWith('.tgz'));
  if (tarball === undefined) {
    throw new Error(`pnpm pack wrote no tarball into ${workDir}`);
  }
  const appDir: string = path.join(workDir, 'app');
  mkdirSync(appDir);
  writeFileSync(path.join(appDir, 'package.json'), '{ "private": true }\n');
  runOrThrow('npm', ['install', '--no-audit', '--no-fund', path.join(workDir, tarball)], appDir);
  return path.join(appDir, 'node_modules', '.bin', 'nautink');
}

async function waitForUrl(child: ChildProcess): Promise<string> {
  let output: string = '';
  return new Promise((resolve, reject) => {
    const timer: NodeJS.Timeout = setTimeout(() => {
      reject(new Error(`nautink did not start within ${String(START_TIMEOUT_MS)} ms:\n${output}`));
    }, START_TIMEOUT_MS);
    const onData = (chunk: Buffer): void => {
      output += chunk.toString();
      const match: RegExpExecArray | null = URL_PATTERN.exec(output);
      if (match?.[1] !== undefined) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('exit', (code: number | null) => {
      clearTimeout(timer);
      reject(new Error(`nautink exited with code ${String(code)} before starting:\n${output}`));
    });
  });
}

async function expectResponse(url: string, mustContain: string): Promise<void> {
  const response: Response = await fetch(url);
  const body: string = await response.text();
  if (!response.ok || !body.includes(mustContain)) {
    throw new Error(
      `GET ${url} answered ${String(response.status)} without "${mustContain}":\n${body}`,
    );
  }
}

async function smokeTest(bin: string): Promise<void> {
  const child: ChildProcess = spawn(bin, ['--no-open', '--port', '0'], {
    env: { ...process.env, CLAUDE_BIN: 'nautink-check-pack-no-claude' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const url: string = await waitForUrl(child);
    await expectResponse(`${url}/`, '<div id="root">');
    await expectResponse(`${url}/api/info`, '"repoDir"');
  } finally {
    child.kill();
  }
}

const workDir: string = mkdtempSync(path.join(os.tmpdir(), 'nautink-pack-'));
try {
  await smokeTest(packAndInstall(workDir));
  process.stdout.write(
    'Pack check passed: the installed nautink command serves the app and the API.\n',
  );
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
