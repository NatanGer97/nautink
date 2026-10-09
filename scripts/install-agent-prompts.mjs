#!/usr/bin/env node
/**
 * Installs this repo's Codex CLI prompts into ~/.codex/prompts, which is the only place
 * Codex looks for custom prompts. Symlinks, so editing the repo copy updates the installed one.
 * Pass --force to replace a prompt of the same name that is not already our symlink.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const SOURCE_DIR = path.join(import.meta.dirname, '..', '.codex', 'prompts');
const TARGET_DIR = path.join(os.homedir(), '.codex', 'prompts');
const force = process.argv.includes('--force');

/** Where an existing entry points, or undefined when it is not a symlink. */
function linkTarget(entryPath) {
  if (!existsSync(entryPath) && !lstatSync(entryPath, { throwIfNoEntry: false })) {
    return undefined;
  }
  const stats = lstatSync(entryPath, { throwIfNoEntry: false });
  return stats?.isSymbolicLink() === true ? readlinkSync(entryPath) : undefined;
}

mkdirSync(TARGET_DIR, { recursive: true });

const skipped = [];
const installed = [];

for (const name of readdirSync(SOURCE_DIR).filter((entry) => entry.endsWith('.md'))) {
  const source = path.join(SOURCE_DIR, name);
  const target = path.join(TARGET_DIR, name);
  const existing = lstatSync(target, { throwIfNoEntry: false });
  if (existing !== undefined) {
    if (linkTarget(target) === source) {
      installed.push(name);
      continue;
    }
    if (!force) {
      skipped.push(name);
      continue;
    }
    unlinkSync(target);
  }
  symlinkSync(source, target);
  installed.push(name);
}

console.log(
  `Installed ${installed.length} Codex prompt(s) into ${TARGET_DIR}: ${installed.join(', ')}`,
);

if (skipped.length > 0) {
  console.error(
    `Left alone (already exists and is not ours, re-run with --force to replace): ${skipped.join(', ')}`,
  );
  process.exit(1);
}
