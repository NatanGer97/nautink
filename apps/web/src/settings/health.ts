import { API_ROUTES } from '@nautink/contracts/routes';
import { healthResponseSchema } from '@nautink/contracts/server-info';

import type { HealthResponse } from '@nautink/contracts/server-info';

/** What Settings shows for the Claude Code connection (PRD §4.5, M8). */
export type ConnectionStatus =
  | { kind: 'checking' }
  | { kind: 'connected'; version: string | null }
  | { kind: 'disconnected'; error: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Asks the local server whether it can start Claude Code. Throws when the answer is unusable. */
export async function fetchHealth(fetchImpl: FetchLike = fetch): Promise<HealthResponse> {
  const response: Response = await fetchImpl(API_ROUTES.health, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`The server answered ${String(response.status)} for ${API_ROUTES.health}.`);
  }
  return healthResponseSchema.parse(await response.json());
}

/** The connection status for a health answer. */
export function toConnectionStatus(health: HealthResponse): ConnectionStatus {
  if (health.claude.isFound) {
    return { kind: 'connected', version: health.claude.version };
  }
  return { kind: 'disconnected', error: health.claude.error ?? 'Claude Code was not found.' };
}

/** The connection status, never throwing: a failed check is shown as "Not connected". */
export async function checkConnection(fetchImpl: FetchLike = fetch): Promise<ConnectionStatus> {
  try {
    return toConnectionStatus(await fetchHealth(fetchImpl));
  } catch (err) {
    const message: string = err instanceof Error ? err.message : String(err);
    return { kind: 'disconnected', error: `Cannot reach the local server. ${message}` };
  }
}
