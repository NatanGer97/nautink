import { createServer } from 'node:http';

import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { HEALTH_TIMEOUT_MS } from './health.ts';

import type { ServerConfig } from './config.ts';
import type { Logger } from './logger.ts';
import type { Express } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Localhost only: this server drives the user's personal Claude Code login. */
export const HOST: string = '127.0.0.1';

function describeListenError(port: number, err: unknown): string {
  const code: unknown = typeof err === 'object' && err !== null && 'code' in err ? err.code : null;
  if (code === 'EADDRINUSE') {
    return `Port ${String(port)} on ${HOST} is already in use. Set API_PORT to use another port.`;
  }
  const reason: string = err instanceof Error ? err.message : 'unknown error';
  return `Cannot listen on ${HOST}:${String(port)}: ${reason}`;
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

function createAppFromConfig(config: ServerConfig, homeDir: string): Express {
  return createApp({
    claudeBin: config.claudeBin,
    repoDir: config.repoDir,
    homeDir,
    healthTimeoutMs: HEALTH_TIMEOUT_MS,
  });
}

/** Reads the config from the environment and starts the server. Throws on invalid config or a taken port. */
export async function startServer(options: StartOptions): Promise<Server> {
  const config: ServerConfig = loadConfig(options.env, options.homeDir);
  const server: Server = await listen(createAppFromConfig(config, options.homeDir), config.port);
  const { port } = server.address() as AddressInfo;
  options.logger.info(`Nautink server on http://${HOST}:${String(port)}`);
  if (config.repoDir !== null) {
    options.logger.info(`Repo-aware mode: ${config.repoDir}`);
  }
  return server;
}
