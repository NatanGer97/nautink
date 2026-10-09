import express from 'express';

import { NOT_FOUND, sendError } from './http-errors.ts';
import { createInfoRouter } from './info-routes.ts';
import { parseJsonBody } from './json-body.ts';
import { RepoSelection } from './repo-selection.ts';

import type { Express, Request, Response } from 'express';

export interface AppOptions {
  claudeBin: string;
  /** The codebase Claude may read until `POST /api/repo` changes it; `null` turns repo-aware mode off. */
  repoDir: string | null;
  homeDir: string;
  healthTimeoutMs: number;
}

/** The Express app: the API of PRD §7.4. */
export function createApp(options: AppOptions): Express {
  const app: Express = express();
  const repoSelection: RepoSelection = new RepoSelection(options.repoDir);
  app.disable('x-powered-by');
  app.use(parseJsonBody);
  app.use(createInfoRouter({ ...options, repoSelection }));
  app.use('/api', (req: Request, res: Response) => {
    sendError(res, NOT_FOUND, `Not found: ${req.method} ${req.originalUrl}`);
  });
  return app;
}
