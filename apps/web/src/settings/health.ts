import { AGENT_CLI_NAMES } from '@nautink/contracts/agents';
import { API_ROUTES } from '@nautink/contracts/routes';
import { healthResponseSchema } from '@nautink/contracts/server-info';

import type { AgentId } from '@nautink/contracts/agents';
import type { CliStatus, HealthResponse } from '@nautink/contracts/server-info';

/** What Settings shows for the chosen agent's CLI connection (PRD §4.5, M8; ADR-002). */
export type ConnectionStatus =
  | { kind: 'checking' }
  | { kind: 'connected'; version: string | null }
  | { kind: 'disconnected'; error: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Asks the local server whether it can start each agent CLI. Throws when the answer is unusable. */
export async function fetchHealth(fetchImpl: FetchLike = fetch): Promise<HealthResponse> {
  const response: Response = await fetchImpl(API_ROUTES.health, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`The server answered ${String(response.status)} for ${API_ROUTES.health}.`);
  }
  return healthResponseSchema.parse(await response.json());
}

/** The connection status of `agent`'s CLI in a health answer. */
export function toConnectionStatus(health: HealthResponse, agent: AgentId): ConnectionStatus {
  const cli: CliStatus = health[agent];
  if (cli.isFound) {
    return { kind: 'connected', version: cli.version };
  }
  return { kind: 'disconnected', error: cli.error ?? `${AGENT_CLI_NAMES[agent]} was not found.` };
}

/** The connection status, never throwing: a failed check is shown as "Not connected". */
export async function checkConnection(
  agent: AgentId,
  fetchImpl: FetchLike = fetch,
): Promise<ConnectionStatus> {
  try {
    return toConnectionStatus(await fetchHealth(fetchImpl), agent);
  } catch (err) {
    const message: string = err instanceof Error ? err.message : String(err);
    return { kind: 'disconnected', error: `Cannot reach the local server. ${message}` };
  }
}
