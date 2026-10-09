#!/usr/bin/env node
/**
 * Fails a pull request that changes a workspace's source without adding a changeset, so each
 * workspace's version and `CHANGELOG.md` keep a note of what changed. Documentation, Markdown
 * and repo configuration are exempt — they change no workspace's behaviour.
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const SOURCE_PREFIXES = ['apps/', 'packages/'];
const CHANGESET_DIRECTORY = '.changeset/';
const CHANGESET_NON_ENTRIES = new Set(['.changeset/README.md', '.changeset/config.json']);
const LISTED_SOURCE_LIMIT = 10;

export const HOW_TO_ADD_ONE = 'pnpm changeset';

function isSourceFile(file) {
  return SOURCE_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isChangesetEntry(file) {
  return (
    file.startsWith(CHANGESET_DIRECTORY) && file.endsWith('.md') && !CHANGESET_NON_ENTRIES.has(file)
  );
}

/**
 * Decides from a list of changed files whether a changeset is missing.
 */
export function decide(changedFiles) {
  const sourceFiles = changedFiles.filter(isSourceFile);
  if (sourceFiles.length === 0) {
    return { exitCode: 0, message: 'No workspace source changed, so no changeset is needed.' };
  }
  if (changedFiles.some(isChangesetEntry)) {
    return { exitCode: 0, message: 'Workspace source changed and a changeset is present.' };
  }
  const listed = sourceFiles.slice(0, LISTED_SOURCE_LIMIT).map((file) => `  - ${file}`);
  const remaining = sourceFiles.length - listed.length;
  const andMore = remaining > 0 ? [`  ... and ${remaining} more`] : [];
  return {
    exitCode: 1,
    message: [
      'This change touches workspace source but carries no changeset:',
      ...listed,
      ...andMore,
      '',
      `Add one with \`${HOW_TO_ADD_ONE}\`, commit the file it writes under \`.changeset/\`, and push again.`,
      'A change that is only documentation, Markdown or repo configuration needs none.',
    ].join('\n'),
  };
}

function readChangedFiles(baseRef) {
  const result = spawnSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error(`Could not diff against "${baseRef}":`);
    console.error(result.stderr?.trim() ?? '');
    process.exit(1);
  }
  return result.stdout.split('\n').filter((line) => line.length > 0);
}

function main() {
  const baseRef = process.argv[2] ?? process.env.BASE_REF;
  if (baseRef === undefined) {
    console.error('Usage: node scripts/check-changeset.mjs <base-ref>  (or set BASE_REF)');
    process.exit(1);
  }
  const { exitCode, message } = decide(readChangedFiles(baseRef));
  if (exitCode === 0) {
    console.log(`Changeset check passed. ${message}`);
    return;
  }
  console.error(message);
  process.exit(exitCode);
}

if (process.argv[1]?.endsWith('check-changeset.mjs')) {
  main();
}
