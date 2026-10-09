#!/usr/bin/env node
/**
 * Formats and lints one file the way the repo's gates do, for any agent harness.
 * Claude Code calls it through the PostToolUse hook; other harnesses call the CLI
 * directly (`pnpm lint:file <path>`) after writing a file.
 */
import { ESLint } from 'eslint';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import prettier from 'prettier';

export const REPO_ROOT = path.join(import.meta.dirname, '..');
export const BLOCKING_EXIT_CODE = 2;

const LINTABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
// Prettier's Node API applies no ignore file unless it is named, unlike the CLI.
const IGNORE_FILES = [path.join(REPO_ROOT, '.gitignore'), path.join(REPO_ROOT, '.prettierignore')];

/** The absolute path to check, or undefined when there is nothing this script can check. */
export function resolveTargetPath(filePath: unknown): string | undefined {
  if (typeof filePath !== 'string' || filePath === '') {
    return undefined;
  }
  const absolutePath = path.resolve(REPO_ROOT, filePath);
  const isInsideRepo = absolutePath.startsWith(REPO_ROOT + path.sep);
  if (!isInsideRepo || !existsSync(absolutePath)) {
    return undefined;
  }
  return absolutePath;
}

async function format(filePath: string): Promise<void> {
  const info = await prettier.getFileInfo(filePath, {
    resolveConfig: true,
    ignorePath: IGNORE_FILES,
  });
  if (info.ignored || info.inferredParser === null) {
    return;
  }
  const config = await prettier.resolveConfig(filePath);
  const source = readFileSync(filePath, 'utf8');
  const formatted = await prettier.format(source, { ...config, filepath: filePath });
  if (formatted !== source) {
    writeFileSync(filePath, formatted);
  }
}

/** The ESLint report for the file, or an empty string when it is clean or not linted. */
async function lint(filePath: string): Promise<string> {
  const eslint = new ESLint({ cwd: REPO_ROOT, fix: true });
  if (await eslint.isPathIgnored(filePath)) {
    return '';
  }
  const results = await eslint.lintFiles([filePath]);
  await ESLint.outputFixes(results);
  const hasProblem = results.some((result) => result.errorCount + result.warningCount > 0);
  if (!hasProblem) {
    return '';
  }
  const formatter = await eslint.loadFormatter('stylish');
  return await formatter.format(results);
}

/**
 * Formats the file, then lints it.
 * Returns the ESLint report when the file still has problems, and an empty string otherwise.
 */
export async function checkFile(rawPath: unknown): Promise<string> {
  const filePath = resolveTargetPath(rawPath);
  if (filePath === undefined) {
    return '';
  }
  await format(filePath);
  if (!LINTABLE_EXTENSIONS.has(path.extname(filePath))) {
    return '';
  }
  return await lint(filePath);
}

async function main(): Promise<void> {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error('usage: pnpm lint:file <path> [...paths]');
    process.exit(1);
  }
  const reports: string[] = [];
  for (const target of targets) {
    const report = await checkFile(target);
    if (report !== '') {
      reports.push(report);
    }
  }
  if (reports.length > 0) {
    console.error(reports.join('\n'));
    process.exit(BLOCKING_EXIT_CODE);
  }
}

// Only the CLI entry point runs main; importers get the functions alone.
if (process.argv[1] === import.meta.filename) {
  await main();
}
