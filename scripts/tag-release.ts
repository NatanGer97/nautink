#!/usr/bin/env node
/**
 * The release workflow's publish step: tags the whole app once, as `v<version>`, and creates one
 * GitHub Release whose notes are every workspace's changelog section for that version.
 *
 * Every workspace is in one Changesets `fixed` group (`.changeset/config.json`), so they all share a
 * version; a mismatch is an error. It does nothing when that version is already tagged, or when
 * nothing was ever released (`0.0.0`), so it is safe on every push to `main`.
 *
 *   node scripts/tag-release.ts   # needs git push access and GH_TOKEN for `gh release create`
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const WORKSPACE_PARENTS = ['apps', 'packages'] as const;
const UNRELEASED = '0.0.0';

export interface WorkspaceVersion {
  name: string;
  version: string;
}

export interface WorkspaceChangelog {
  name: string;
  changelog: string;
}

/** The one version every workspace shares. Throws when they differ. */
export function releaseVersion(workspaces: WorkspaceVersion[]): string {
  const first = workspaces[0];
  if (first === undefined) {
    throw new Error('No workspaces found under apps/ and packages/.');
  }
  if (workspaces.some((workspace) => workspace.version !== first.version)) {
    const listed = workspaces.map((workspace) => `${workspace.name} ${workspace.version}`);
    throw new Error(
      `Workspaces must share one version (the "fixed" group in .changeset/config.json): ${listed.join(', ')}.`,
    );
  }
  return first.version;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The body under `## <version>` in a Changesets changelog, up to the next `## `, trimmed. */
export function changelogSection(changelog: string, version: string): string | undefined {
  const heading = new RegExp(`^## ${escapeRegExp(version)}$`, 'm');
  const start = heading.exec(changelog);
  if (start === null) {
    return undefined;
  }
  const rest = changelog.slice(start.index + start[0].length);
  const next = /^## /m.exec(rest);
  return (next === null ? rest : rest.slice(0, next.index)).trim();
}

/** One `## <workspace>` block per workspace with a section for `version`. */
export function releaseNotes(version: string, workspaces: WorkspaceChangelog[]): string {
  const blocks = workspaces.flatMap((workspace) => {
    const section = changelogSection(workspace.changelog, version);
    return section === undefined ? [] : [`## ${workspace.name}\n\n${section}`];
  });
  return blocks.length === 0 ? 'No changes.' : blocks.join('\n\n');
}

function workspaceDirs(): string[] {
  return WORKSPACE_PARENTS.flatMap((parent) =>
    readdirSync(path.join(ROOT, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(ROOT, parent, entry.name))
      .filter((dir) => existsSync(path.join(dir, 'package.json'))),
  );
}

function readWorkspace(dir: string): WorkspaceVersion & WorkspaceChangelog {
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
    name: string;
    version: string;
  };
  const changelogPath = path.join(dir, 'CHANGELOG.md');
  const changelog = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : '';
  return { name: pkg.name, version: pkg.version, changelog };
}

function isTagged(tag: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--quiet', '--verify', `refs/tags/${tag}`], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function main(): void {
  const workspaces = workspaceDirs().map(readWorkspace);
  const version = releaseVersion(workspaces);
  const tag = `v${version}`;
  if (version === UNRELEASED) {
    console.log(`Version is ${UNRELEASED}: nothing has been released yet.`);
    return;
  }
  if (isTagged(tag)) {
    console.log(`${tag} is already tagged.`);
    return;
  }
  const notes = releaseNotes(version, workspaces);
  // A lightweight tag: it needs no git identity on the runner, and the Release carries the notes.
  execFileSync('git', ['tag', tag], { stdio: 'inherit' });
  execFileSync('git', ['push', 'origin', `refs/tags/${tag}`], { stdio: 'inherit' });
  execFileSync(
    'gh',
    ['release', 'create', tag, '--verify-tag', '--title', `Nautink ${tag}`, '--notes-file', '-'],
    { input: notes, stdio: ['pipe', 'inherit', 'inherit'] },
  );
  console.log(`Tagged and released ${tag}.`);
}

if (process.argv[1]?.endsWith('tag-release.ts')) {
  main();
}
