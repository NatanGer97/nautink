import { API_ROUTES } from '@nautink/contracts/routes';
import { errorResponseSchema, infoResponseSchema } from '@nautink/contracts/server-info';

import type { ErrorResponse, InfoResponse, RepoRequest } from '@nautink/contracts/server-info';
import type { z } from 'zod';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** The server's `{ error }` message, or the status when the body is not one. */
async function failureMessage(response: Response, route: string): Promise<string> {
  const fallback: string = `The server answered ${String(response.status)} for ${route}.`;
  try {
    const parsed: z.ZodSafeParseResult<ErrorResponse> = errorResponseSchema.safeParse(
      await response.json(),
    );
    return parsed.success ? parsed.data.error : fallback;
  } catch {
    return fallback;
  }
}

async function readInfo(response: Response, route: string): Promise<string | null> {
  if (!response.ok) {
    throw new Error(await failureMessage(response, route));
  }
  const info: InfoResponse = infoResponseSchema.parse(await response.json());
  return info.repoDir;
}

/** The codebase folder Claude can read (`GET /api/info`), or `null` when none is chosen. */
export async function fetchRepoDir(fetchImpl: FetchLike = fetch): Promise<string | null> {
  const response: Response = await fetchImpl(API_ROUTES.info, {
    headers: { accept: 'application/json' },
  });
  return readInfo(response, API_ROUTES.info);
}

/**
 * Chooses the codebase folder (`POST /api/repo`), or turns repo-aware mode off with `null`.
 * Returns the folder the server resolved. Throws the server's message, such as a missing folder.
 */
export async function saveRepoDir(
  path: string | null,
  fetchImpl: FetchLike = fetch,
): Promise<string | null> {
  const trimmed: string | null = path === null ? null : path.trim();
  if (trimmed === '') {
    throw new Error('Enter the path of a folder.');
  }
  const body: RepoRequest = { path: trimmed };
  const response: Response = await fetchImpl(API_ROUTES.repo, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return readInfo(response, API_ROUTES.repo);
}

/** The last folder name of a path, for the top bar badge. */
export function folderName(path: string): string {
  const parts: string[] = path.split(/[\\/]/).filter((part) => part !== '');
  return parts.at(-1) ?? path;
}
