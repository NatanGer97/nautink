#!/usr/bin/env node
/**
 * Proves the coverage bars are armed: an uncovered source file makes `vitest run` fail on the
 * package's line threshold, in every package listed in GATED. Nothing type-checks the Vitest
 * configs, so a typo such as `thresholds: { line: 100 }` would otherwise disarm a gate in silence.
 */
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import type { SpawnSyncReturns } from 'node:child_process';

const PROBE_SOURCE = 'export const probe = (value: number): number => {\n  return value + 1;\n};\n';
const THRESHOLD_ERROR = 'does not meet global threshold';

// Add a package here as soon as its Vitest config sets a coverage threshold, e.g.
// { name: 'packages/core', root: path.join(import.meta.dirname, '..', 'packages', 'core') }.
interface GatedPackage {
  name: string;
  root: string;
}

const GATED: GatedPackage[] = [
  {
    name: 'packages/contracts',
    root: path.join(import.meta.dirname, '..', 'packages', 'contracts'),
  },
  {
    name: 'packages/storage',
    root: path.join(import.meta.dirname, '..', 'packages', 'storage'),
  },
  {
    name: 'apps/server',
    root: path.join(import.meta.dirname, '..', 'apps', 'server'),
  },
];

// A noisy suite overruns `spawnSync`'s 1 MB default and would truncate away the very line this
// script looks for.
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

function runTests(root: string): SpawnSyncReturns<string> {
  return spawnSync('pnpm', ['exec', 'vitest', 'run'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: MAX_OUTPUT_BYTES,
  });
}

function collectFailures(name: string, result: SpawnSyncReturns<string>): string[] {
  const failures: string[] = [];
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status === 0) {
    failures.push(`uncovered source in ${name} did not fail the run`);
  }
  if (!output.includes(THRESHOLD_ERROR)) {
    failures.push(`expected "${THRESHOLD_ERROR}" in ${name}'s output, got none`);
  }
  return failures;
}

function probe({ name, root }: GatedPackage): string[] {
  const probePath = path.join(root, 'src', 'coverage-gate-probe.ts');
  writeFileSync(probePath, PROBE_SOURCE);
  try {
    return collectFailures(name, runTests(root));
  } finally {
    rmSync(probePath, { force: true });
  }
}

function main(): void {
  if (GATED.length === 0) {
    console.log('Coverage gate check skipped: no package sets a coverage threshold yet.');
    return;
  }
  const failures = GATED.flatMap((gated) => probe(gated));
  if (failures.length > 0) {
    console.error('Coverage gate check failed:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }
  console.log(
    `Coverage gate check passed (uncovered code fails the run in ${GATED.map((gated) => gated.name).join(' and ')}).`,
  );
}

main();
