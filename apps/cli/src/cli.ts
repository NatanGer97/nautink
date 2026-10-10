#!/usr/bin/env node
import { createProcessLogger } from '@nautink/server/logger';
import { startServer } from '@nautink/server/server';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { openBrowser } from './open-browser.ts';
import { run } from './run.ts';

/** `process.argv` starts with the Node binary and this script. */
const FIRST_ARG: number = 2;

// Built, this file is `dist/cli.js`: the web app sits in `dist/web` and `package.json` one level up.
const packageJson: { version: string } = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', 'package.json'), 'utf8'),
) as { version: string };

process.exitCode = await run(process.argv.slice(FIRST_ARG), {
  env: process.env,
  homeDir: os.homedir(),
  platform: process.platform,
  version: packageJson.version,
  webDistDir: path.join(import.meta.dirname, 'web'),
  logger: createProcessLogger(),
  startServer,
  openBrowser: async (url: string, platform: NodeJS.Platform) => openBrowser(url, platform, spawn),
});
