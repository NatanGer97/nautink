#!/usr/bin/env node
/**
 * Proves both agent lint paths are armed: a file with a lint error exits 2 with the
 * ESLint output on stderr, a clean file exits 0 and is left formatted. The Claude Code
 * PostToolUse hook and the harness-agnostic `lint:file` CLI must agree on every verdict —
 * a harness without hooks relies on the CLI alone.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import type { SpawnSyncReturns } from 'node:child_process';

const REPO_ROOT = path.join(import.meta.dirname, '..');
const HOOK = path.join(REPO_ROOT, '.claude', 'hooks', 'lint-edited-file.ts');
const CLI = path.join(REPO_ROOT, 'scripts', 'lint-file.ts');
const DIRTY_SOURCE = "export function report() {\n  console.log('debris')\n}\n";
const UNFORMATTED_SOURCE = "export const value: string =    'quoted'\n";
const FORMATTED_SOURCE = "export const value: string = 'quoted';\n";
const IGNORED_SOURCE = '|  a  |  hand-wrapped  table  |\n';
const BLOCKING_EXIT_CODE = 2;

function runHook(filePath: string): SpawnSyncReturns<string> {
  const payload = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: filePath },
    cwd: REPO_ROOT,
  });
  return spawnSync(process.execPath, [HOOK], {
    input: payload,
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function runCli(filePath: string): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [CLI, filePath], { cwd: REPO_ROOT, encoding: 'utf8' });
}

/** Every case the hook is checked on must get the same verdict from the CLI. */
function checkCliParity(directory: string, failures: string[]): void {
  const cases = {
    'dirty file': { source: DIRTY_SOURCE, name: 'cli-dirty.ts', status: BLOCKING_EXIT_CODE },
    'clean file': { source: UNFORMATTED_SOURCE, name: 'cli-clean.ts', status: 0 },
    'ignored file': { source: IGNORED_SOURCE, name: 'cli-prose.md', status: 0 },
  };
  for (const [label, { source, name, status }] of Object.entries(cases)) {
    const filePath = path.join(directory, name);
    writeFileSync(filePath, source);
    const result = runCli(filePath);
    if (result.status !== status) {
      failures.push(
        `${label} via CLI: expected exit ${status}, got ${result.status} (${result.stderr.trim()})`,
      );
    }
  }
  const missing = runCli(path.join(directory, 'cli-gone.ts'));
  if (missing.status !== 0) {
    failures.push(`a deleted file via CLI: expected exit 0, got ${missing.status}`);
  }
}

function checkDirtyFile(directory: string, failures: string[]): void {
  const filePath = path.join(directory, 'dirty.ts');
  writeFileSync(filePath, DIRTY_SOURCE);
  const result = runHook(filePath);
  if (result.status !== BLOCKING_EXIT_CODE) {
    failures.push(`dirty file: expected exit ${BLOCKING_EXIT_CODE}, got ${result.status}`);
  }
  if (!result.stderr.includes('no-console')) {
    failures.push(
      `dirty file: stderr did not name the failing rule (got: ${result.stderr.trim()})`,
    );
  }
}

function checkCleanFile(directory: string, failures: string[]): void {
  const filePath = path.join(directory, 'clean.ts');
  writeFileSync(filePath, UNFORMATTED_SOURCE);
  const result = runHook(filePath);
  if (result.status !== 0) {
    failures.push(`clean file: expected exit 0, got ${result.status} (${result.stderr.trim()})`);
  }
  const written = readFileSync(filePath, 'utf8');
  if (written !== FORMATTED_SOURCE) {
    failures.push(`clean file: hook did not format it (got: ${written})`);
  }
}

function checkIgnoredFile(directory: string, failures: string[]): void {
  const filePath = path.join(directory, 'prose.md');
  writeFileSync(filePath, IGNORED_SOURCE);
  const result = runHook(filePath);
  if (result.status !== 0) {
    failures.push(`ignored file: expected exit 0, got ${result.status} (${result.stderr.trim()})`);
  }
  if (readFileSync(filePath, 'utf8') !== IGNORED_SOURCE) {
    failures.push('ignored file: hook reformatted a file .prettierignore excludes');
  }
}

function checkUncheckableFile(directory: string, failures: string[]): void {
  const cases = {
    'a deleted file': path.join(directory, 'gone.ts'),
    'a file outside the repo': path.join(os.tmpdir(), 'outside-the-repo.ts'),
  };
  for (const [label, filePath] of Object.entries(cases)) {
    const result = runHook(filePath);
    if (result.status !== 0) {
      failures.push(`${label}: expected exit 0, got ${result.status} (${result.stderr.trim()})`);
    }
  }
}

// A lowercase name: the lint rules check directory names for kebab case too.
const directory = path.join(REPO_ROOT, `tmp-agent-hook-check-${process.pid}`);
mkdirSync(directory);
const failures: string[] = [];
try {
  checkDirtyFile(directory, failures);
  checkCleanFile(directory, failures);
  checkIgnoredFile(directory, failures);
  checkUncheckableFile(directory, failures);
  checkCliParity(directory, failures);
} finally {
  rmSync(directory, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error('Agent hook check failed:\n' + failures.map((line) => `  - ${line}`).join('\n'));
  process.exit(1);
}

console.log(
  'Agent hook check passed (dirty file blocks, clean file is formatted, ignored and unreachable files are skipped, CLI agrees with the hook).',
);
