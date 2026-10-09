import { API_ROUTES } from '@nautink/contracts/routes';
import { repoRequestSchema } from '@nautink/contracts/server-info';
import { Router } from 'express';

import { checkClaude } from './health.ts';
import { BAD_REQUEST, describeIssues, sendError } from './http-errors.ts';
import { InvalidRepoDirError, resolveRepoDir } from './repo-dir.ts';

import type { RepoSelection } from './repo-selection.ts';
import type { InfoResponse, RepoRequest } from '@nautink/contracts/server-info';
import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';

export interface InfoRoutesOptions {
  claudeBin: string;
  repoSelection: RepoSelection;
  homeDir: string;
  healthTimeoutMs: number;
}

function info(repoSelection: RepoSelection): InfoResponse {
  return { repoDir: repoSelection.get() };
}

async function chooseRepoDir(options: InfoRoutesOptions, path: string | null): Promise<void> {
  const repoDir: string | null = path === null ? null : await resolveRepoDir(path, options.homeDir);
  options.repoSelection.set(repoDir);
}

async function handleRepoRequest(
  options: InfoRoutesOptions,
  body: unknown,
  res: Response,
): Promise<void> {
  const parsed: z.ZodSafeParseResult<RepoRequest> = repoRequestSchema.safeParse(body);
  if (!parsed.success) {
    sendError(res, BAD_REQUEST, describeIssues(parsed.error));
    return;
  }
  await chooseRepoDir(options, parsed.data.path);
  res.json(info(options.repoSelection));
}

function createRepoHandler(options: InfoRoutesOptions): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await handleRepoRequest(options, req.body, res);
    } catch (err) {
      if (!(err instanceof InvalidRepoDirError)) {
        throw err;
      }
      sendError(res, BAD_REQUEST, err.message);
    }
  };
}

/** A handler whose JSON answer does not depend on the request. */
function respondWith(produce: () => Promise<unknown>): RequestHandler {
  return async (...[, res]: Parameters<RequestHandler>): Promise<void> => {
    res.json(await produce());
  };
}

/** `GET /api/info`, `GET /api/health` and `POST /api/repo` (PRD §7.4). */
export function createInfoRouter(options: InfoRoutesOptions): Router {
  const router: Router = Router();
  router.get(
    API_ROUTES.info,
    respondWith(async () => Promise.resolve(info(options.repoSelection))),
  );
  router.get(
    API_ROUTES.health,
    respondWith(async () => checkClaude(options.claudeBin, options.healthTimeoutMs)),
  );
  router.post(API_ROUTES.repo, createRepoHandler(options));
  return router;
}
