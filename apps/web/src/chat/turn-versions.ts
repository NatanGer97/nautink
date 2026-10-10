import { addVersion, countVersions } from '@nautink/storage/versions';

import { agentName } from './agent-name.ts';

import type { AgentId } from '@nautink/contracts/agents';
import type { NautinkDb } from '@nautink/storage/db';

/** Fired on `window` after a version is added, so the history panel can reload. */
export const VERSIONS_CHANGED_EVENT: string = 'nautink:versions-changed';

/** `detail` of `VERSIONS_CHANGED_EVENT`. */
export interface VersionsChangedDetail {
  diagramId: string;
}

/** The label of the snapshot taken before an agent's first change to a diagram (v1): "Before Codex". */
export function beforeAgentLabel(agent: AgentId): string {
  return `Before ${agentName(agent)}`;
}

export interface TurnVersionInput {
  db: NautinkDb;
  diagramId: string;
  /** The code when the turn started. */
  before: string;
  /** The code the turn ended with. */
  after: string;
  /** What the user asked. */
  prompt: string;
  /** The agent that wrote `after`. */
  agent: AgentId;
}

/**
 * Saves a `claude` version of the turn's result, as v1 does: before Claude's first change to a
 * diagram, the starting code is kept as a named "Before Claude" version so it can be restored.
 */
export async function saveTurnVersions(input: TurnVersionInput): Promise<void> {
  const { db, diagramId, before, after, prompt, agent } = input;
  const isFirstChange: boolean = (await countVersions(db, diagramId)) === 0;
  if (isFirstChange && before.trim() !== '') {
    const label: string = beforeAgentLabel(agent);
    await addVersion(db, { diagramId, code: before, kind: 'manual', label });
  }
  await addVersion(db, { diagramId, code: after, kind: 'claude', prompt, agent });
  const detail: VersionsChangedDetail = { diagramId };
  window.dispatchEvent(new CustomEvent(VERSIONS_CHANGED_EVENT, { detail }));
}
