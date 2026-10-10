import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { HEALTH_TIMEOUT_MS } from './health.ts';
import { findWebDist } from './web-app.ts';

import type { ServerConfig } from './config.ts';
import type { Logger } from './logger.ts';
import type { Express } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Localhost only: this server drives the user's personal Claude Code login. */
export const HOST: string = '127.0.0.1';

/** The monorepo root, where the built web app lives. */
export const REPO_ROOT: string = path.resolve(import.meta.dirname, '..', '..', '..');

/**
 * The CLI's working directory when no codebase is selected: an empty folder, so a chat never picks
 * up a project's `AGENTS.md`, `CLAUDE.md` or hooks (`--setting-sources project` reads them from cwd).
 */
export function prepareNeutralWorkDir(): string {
  const workDir: string = path.join(os.tmpdir(), 'nautink-claude');
  mkdirSync(workDir, { recursive: true });
  return workDir;
}

function describeListenError(port: number, err: unknown): string {
  // `listen` fails with a system error (EADDRINUSE, EACCES) or a RangeError for a bad port.
  const failure: NodeJS.ErrnoException = err as NodeJS.ErrnoException;
  if (failure.code === 'EADDRINUSE') {
    return `Port ${String(port)} on ${HOST} is already in use. Set API_PORT to use another port.`;
  }
  return `Cannot listen on ${HOST}:${String(port)}: ${failure.message}`;
}

/** Starts listening on 127.0.0.1. Rejects with a readable message when the port is taken. */
export async function listen(app: Express, port: number): Promise<Server> {
  const server: Server = createServer(app);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, HOST, resolve);
    });
  } catch (err) {
    throw new Error(describeListenError(port, err), { cause: err });
  }
  return server;
}

export interface StartOptions {
  env: NodeJS.ProcessEnv;
  homeDir: string;
  logger: Logger;
}

function createAppFromConfig(config: ServerConfig, options: StartOptions): Express {
  return createApp({
    claudeBin: config.claudeBin,
    codexBin: config.codexBin,
    logger: options.logger,
    repoDir: config.repoDir,
    homeDir: options.homeDir,
    workDir: prepareNeutralWorkDir(),
    webDistDir: findWebDist(REPO_ROOT, config.isProduction),
    healthTimeoutMs: HEALTH_TIMEOUT_MS,
  });
}

/** Reads the config from the environment and starts the server. Throws on invalid config or a taken port. */
export async function startServer(options: StartOptions): Promise<Server> {
  const config: ServerConfig = loadConfig(options.env, options.homeDir);
  const server: Server = await listen(createAppFromConfig(config, options), config.port);
  const { port } = server.address() as AddressInfo;
  options.logger.info(`Nautink server on http://${HOST}:${String(port)}`);
  if (config.repoDir !== null) {
    options.logger.info(`Repo-aware mode: ${config.repoDir}`);
  }
  return server;
}
