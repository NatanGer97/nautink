import { parseCliArgs, HELP_TEXT } from './args.ts';

import type { CliCommand } from './args.ts';
import type { Logger } from '@nautink/server/logger';
import type { StartOptions } from '@nautink/server/server';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Everything `run` touches outside itself, so tests can pass fakes. */
export interface RunDeps {
  env: NodeJS.ProcessEnv;
  homeDir: string;
  platform: NodeJS.Platform;
  version: string;
  /** The built web app shipped next to the command. */
  webDistDir: string;
  logger: Logger;
  startServer: (options: StartOptions) => Promise<Server>;
  /** Resolves to a hint for the user when no browser could be opened, else `null`. */
  openBrowser: (url: string, platform: NodeJS.Platform) => Promise<string | null>;
}

type RunCommand = Extract<CliCommand, { kind: 'run' }>;

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function startAndOpen(command: RunCommand, deps: RunDeps): Promise<number> {
  const env: NodeJS.ProcessEnv =
    command.port === null ? deps.env : { ...deps.env, API_PORT: String(command.port) };
  const { homeDir, logger, webDistDir } = deps;
  const server: Server = await deps.startServer({ env, homeDir, logger, webDistDir });
  const { port } = server.address() as AddressInfo;
  const url: string = `http://127.0.0.1:${String(port)}`;
  logger.info(`Nautink is running at ${url}`);
  if (command.shouldOpen) {
    const hint: string | null = await deps.openBrowser(url, deps.platform);
    if (hint !== null) {
      logger.error(hint);
    }
  }
  return 0;
}

/**
 * Runs one `nautink` invocation and resolves to its exit code. On success the server keeps
 * running (it holds the process open) until the user stops it.
 */
export async function run(argv: readonly string[], deps: RunDeps): Promise<number> {
  try {
    const command: CliCommand = parseCliArgs(argv);
    if (command.kind === 'help') {
      deps.logger.info(HELP_TEXT);
      return 0;
    }
    if (command.kind === 'version') {
      deps.logger.info(deps.version);
      return 0;
    }
    return await startAndOpen(command, deps);
  } catch (err) {
    deps.logger.error(messageOf(err));
    return 1;
  }
}
