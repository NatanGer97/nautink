import { z } from 'zod';

/** The coding agents Nautink can drive through their local CLI (ADR-002). Claude is the default. */
export const AGENT_IDS: readonly ['claude', 'codex'] = ['claude', 'codex'];

export type AgentId = (typeof AGENT_IDS)[number];

export const agentIdSchema: z.ZodType<AgentId> = z.enum(AGENT_IDS);

/** The agent's name in the UI: "Claude proposes 3 changes", "Ask Codex to fix". */
export const AGENT_LABELS: Readonly<Record<AgentId, string>> = {
  claude: 'Claude',
  codex: 'Codex',
};

/** The CLI the server runs for the agent, as Settings names it. */
export const AGENT_CLI_NAMES: Readonly<Record<AgentId, string>> = {
  claude: 'Claude Code',
  codex: 'Codex CLI',
};
