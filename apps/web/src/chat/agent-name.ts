import { AGENT_LABELS } from '@nautink/contracts/agents';

import { useUiStore } from '../state/ui-store.ts';

import type { AgentId } from '@nautink/contracts/agents';

/** The agent's name in the UI: "Claude" or "Codex" (ADR-002). */
export function agentName(agent: AgentId | undefined): string {
  // A reply or version saved before ADR-002 has no agent: Claude wrote it.
  return AGENT_LABELS[agent ?? 'claude'];
}

/** The chosen agent's name, for code outside React. */
export function currentAgentName(): string {
  return agentName(useUiStore.getState().agent);
}

/** The chosen agent's name, kept current in a component. */
export function useAgentName(): string {
  return useUiStore((state) => agentName(state.agent));
}
