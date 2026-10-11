import { AGENT_CLI_NAMES } from '@nautink/contracts/agents';
import { CLAUDE_MODEL_OPTIONS } from '@nautink/contracts/models';
import { API_ROUTES } from '@nautink/contracts/routes';
import { repoRequestSchema } from '@nautink/contracts/server-info';
import { Router } from 'express';

import { listCodexModels } from '../agents/codex/codex-models.ts';
import { checkCli } from '../agents/health.ts';
import { BAD_REQUEST, describeIssues, sendError } from '../http/http-errors.ts';
import { InvalidRepoDirError, resolveRepoDir } from '../repo/repo-dir.ts';

import type { Logger } from '../logger.ts';
import type { RepoSelection } from '../repo/repo-selection.ts';
import type { ModelOption, ModelsResponse } from '@nautink/contracts/models';
import type { HealthResponse, InfoResponse, RepoRequest } from '@nautink/contracts/server-info';
import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';

export interface InfoRoutesOptions {
  claudeBin: string;
  codexBin: string;
  logger: Logger;
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

/** Checks both agent CLIs at once (ADR-002). */
async function checkHealth(options: InfoRoutesOptions): Promise<HealthResponse> {
  const [claude, codex] = await Promise.all([
    checkCli(
      { bin: options.claudeBin, cliName: AGENT_CLI_NAMES.claude, envVar: 'CLAUDE_BIN' },
      options.healthTimeoutMs,
    ),
    checkCli(
      { bin: options.codexBin, cliName: AGENT_CLI_NAMES.codex, envVar: 'CODEX_BIN' },
      options.healthTimeoutMs,
    ),
  ]);
  return { claude, codex };
}

async function listModels(options: InfoRoutesOptions): Promise<ModelsResponse> {
  const codex: ModelOption[] = await listCodexModels({
    codexBin: options.codexBin,
    timeoutMs: options.healthTimeoutMs,
    logger: options.logger,
  });
  return { claude: [...CLAUDE_MODEL_OPTIONS], codex };
}

/** A handler whose JSON answer does not depend on the request. */
function respondWith(produce: () => Promise<unknown>): RequestHandler {
  return async (...[, res]: Parameters<RequestHandler>): Promise<void> => {
    res.json(await produce());
  };
}

/** `GET /api/info`, `GET /api/health`, `GET /api/models` and `POST /api/repo` (PRD §7.4). */
export function createInfoRouter(options: InfoRoutesOptions): Router {
  const router: Router = Router();
  router.get(
    API_ROUTES.info,
    respondWith(async () => Promise.resolve(info(options.repoSelection))),
  );
  router.get(
    API_ROUTES.health,
    respondWith(async () => checkHealth(options)),
  );
  router.get(
    API_ROUTES.models,
    respondWith(async () => listModels(options)),
  );
  router.post(API_ROUTES.repo, createRepoHandler(options));
  return router;
}
