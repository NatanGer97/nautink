import { z } from 'zod';

import type { AgentId } from './agents.ts';

/** `GET /api/info`: the codebase Claude can read, or `null` when repo-aware mode is off. */
export interface InfoResponse {
  repoDir: string | null;
}

export const infoResponseSchema: z.ZodType<InfoResponse> = z.object({
  repoDir: z.string().nullable(),
});

/** Whether one agent's CLI can be started: its version, or why not. */
export interface CliStatus {
  isFound: boolean;
  version: string | null;
  error: string | null;
}

/** `GET /api/health`: whether each agent's CLI can be started (PRD §4.5, M8; ADR-002). */
export type HealthResponse = Record<AgentId, CliStatus>;

const cliStatusSchema: z.ZodType<CliStatus> = z.object({
  isFound: z.boolean(),
  version: z.string().nullable(),
  error: z.string().nullable(),
});

export const healthResponseSchema: z.ZodType<HealthResponse> = z.object({
  claude: cliStatusSchema,
  codex: cliStatusSchema,
});

/** `POST /api/repo`: choose the codebase folder, or `null` to turn repo-aware mode off. */
export interface RepoRequest {
  path: string | null;
}

export const repoRequestSchema: z.ZodType<RepoRequest> = z.object({
  path: z.string().trim().min(1).nullable(),
});

/** Body of every 4xx and 5xx JSON response. */
export interface ErrorResponse {
  error: string;
}

export const errorResponseSchema: z.ZodType<ErrorResponse> = z.object({ error: z.string() });
