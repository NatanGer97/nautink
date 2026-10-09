import os from 'node:os';
import process from 'node:process';

import { createProcessLogger } from './logger.ts';
import { startServer } from './server.ts';

import type { Logger } from './logger.ts';

const logger: Logger = createProcessLogger();

try {
  await startServer({ env: process.env, homeDir: os.homedir(), logger });
} catch (err) {
  logger.error(err instanceof Error ? err.message : 'The server could not start.');
  process.exitCode = 1;
}
