#!/usr/bin/env node
/**
 * Pushes the rulesets in `.github/rulesets/*.json` to this repository's settings. Each file is
 * matched to a live ruleset by `name`: a match is replaced in place, a new name is created. Live
 * rulesets with no file are left alone and listed, so removing one stays a deliberate step.
 *
 *   node scripts/apply-rulesets.ts             # print what would change
 *   node scripts/apply-rulesets.ts --apply     # change it; needs admin rights on the repository
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const RULESETS_DIR = path.resolve(import.meta.dirname, '..', '.github', 'rulesets');

export interface LiveRuleset {
  id: number;
  name: string;
}

export interface RulesetWrite {
  method: 'POST' | 'PUT';
  endpoint: string;
  name: string;
  body: string;
}

/** The ruleset's `name`. Throws when the file has none, since the name is how it is matched. */
export function rulesetName(json: string, file: string): string {
  const { name } = JSON.parse(json) as { name?: unknown };
  if (typeof name !== 'string' || name === '') {
    throw new Error(`${file} has no "name"; it is how a file is matched to a live ruleset.`);
  }
  return name;
}

/** One write per local ruleset: PUT over the live one of the same name, POST when there is none. */
export function planWrites(
  local: { name: string; body: string }[],
  live: LiveRuleset[],
): RulesetWrite[] {
  const seen = new Set<string>();
  return local.map(({ name, body }) => {
    if (seen.has(name)) {
      throw new Error(`Two files in .github/rulesets/ share the name "${name}".`);
    }
    seen.add(name);
    const match = live.find((ruleset) => ruleset.name === name);
    return match === undefined
      ? { method: 'POST', endpoint: 'repos/{owner}/{repo}/rulesets', name, body }
      : { method: 'PUT', endpoint: `repos/{owner}/{repo}/rulesets/${match.id}`, name, body };
  });
}

/** Live rulesets that no local file names. */
export function unmanaged(local: { name: string }[], live: LiveRuleset[]): LiveRuleset[] {
  return live.filter((ruleset) => !local.some((file) => file.name === ruleset.name));
}

function gh(args: string[], input?: string): string {
  return execFileSync('gh', args, { encoding: 'utf8', input });
}

if (import.meta.main) {
  const apply = process.argv.includes('--apply');
  const local = readdirSync(RULESETS_DIR)
    .filter((entry) => entry.endsWith('.json'))
    .map((file) => {
      const body = readFileSync(path.join(RULESETS_DIR, file), 'utf8');
      return { name: rulesetName(body, file), body };
    });
  const live = JSON.parse(gh(['api', 'repos/{owner}/{repo}/rulesets'])) as LiveRuleset[];

  for (const write of planWrites(local, live)) {
    const verb = write.method === 'POST' ? 'create' : 'update';
    if (apply) {
      gh(['api', '--method', write.method, write.endpoint, '--input', '-'], write.body);
    }
    console.log(`${apply ? '' : 'would '}${verb} ruleset "${write.name}"`);
  }
  for (const ruleset of unmanaged(local, live)) {
    console.log(`left alone: live ruleset "${ruleset.name}" (id ${ruleset.id}) has no file`);
  }
  if (!apply) {
    console.log('Dry run. Pass --apply to change the repository settings.');
  }
}
