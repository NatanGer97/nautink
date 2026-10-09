import { API_ROUTES } from '@nautink/contracts/routes';
import express from 'express';

import { createChatHandler } from './chat-route.ts';
import { guardHost } from './host-guard.ts';
import { NOT_FOUND, sendError } from './http-errors.ts';
import { createInfoRouter } from './info-routes.ts';
import { parseJsonBody } from './json-body.ts';
import { RepoSelection } from './repo-selection.ts';
import { serveWebApp } from './web-app.ts';

import type { Express, Request, Response } from 'express';

export interface AppOptions {
  claudeBin: string;
  /** The codebase Claude may read until `POST /api/repo` changes it; `null` turns repo-aware mode off. */
  repoDir: string | null;
  homeDir: string;
  /** The CLI's working directory when no codebase is selected. */
  workDir: string;
  /** The built web app to serve, or `null` to serve the API only. */
  webDistDir: string | null;
  healthTimeoutMs: number;
}

/** The Express app: the API of PRD §7.4, plus the built web app in production. */
export function createApp(options: AppOptions): Express {
  const app: Express = express();
  const repoSelection: RepoSelection = new RepoSelection(options.repoDir);
  app.disable('x-powered-by');
  app.use(guardHost);
  app.use(parseJsonBody);
  app.use(createInfoRouter({ ...options, repoSelection }));
  app.post(API_ROUTES.chat, createChatHandler({ ...options, repoSelection }));
  app.use('/api', (req: Request, res: Response) => {
    sendError(res, NOT_FOUND, `Not found: ${req.method} ${req.originalUrl}`);
  });
  if (options.webDistDir !== null) {
    serveWebApp(app, options.webDistDir);
  }
  return app;
}
