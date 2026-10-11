import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { afterAll, describe, expect, it } from 'vitest';

import { buildCli } from '../scripts/build.ts';

// Inside `apps/cli`, so the built file resolves `express` and `zod` from this package's dependencies,
// as it does from an installed package.
const ROOT: string = path.join(import.meta.dirname, '..', '.build-test');
const WEB: string = path.join(ROOT, 'web-fixture');
const OUT: string = path.join(ROOT, 'dist');

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('buildCli', () => {
  it('bundles the command with the workspace code and copies the web app', async () => {
    mkdirSync(WEB, { recursive: true });
    writeFileSync(path.join(WEB, 'index.html'), '<title>fixture</title>');
    writeFileSync(path.join(ROOT, 'package.json'), JSON.stringify({ version: '9.9.9' }));

    await buildCli({ webDistDir: WEB, outDir: OUT });

    const cli: string = readFileSync(path.join(OUT, 'cli.js'), 'utf8');
    expect(cli.startsWith('#!/usr/bin/env node\n')).toBe(true);
    expect(cli).not.toContain('@nautink/');
    expect(readFileSync(path.join(OUT, 'web', 'index.html'), 'utf8')).toBe(
      '<title>fixture</title>',
    );
    const version = spawnSync(process.execPath, [path.join(OUT, 'cli.js'), '--version'], {
      encoding: 'utf8',
    });
    expect(version.stdout).toBe('9.9.9\n');
  });

  it('refuses a web app folder that was not built', async () => {
    const missing: string = path.join(ROOT, 'no-web');
    await expect(buildCli({ webDistDir: missing, outDir: OUT })).rejects.toThrow(
      `The web app is not built: ${missing} has no index.html. Run pnpm --filter @nautink/web build first.`,
    );
  });
});
