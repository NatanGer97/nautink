import { describe, expect, it } from 'vitest';

import { AGENT_CLI_NAMES, AGENT_IDS, AGENT_LABELS, agentIdSchema } from './agents.ts';

describe('agents', () => {
  it('lists Claude first, then Codex', () => {
    expect(AGENT_IDS).toEqual(['claude', 'codex']);
  });

  it('names each agent and its CLI', () => {
    expect(AGENT_LABELS).toEqual({ claude: 'Claude', codex: 'Codex' });
    expect(AGENT_CLI_NAMES).toEqual({ claude: 'Claude Code', codex: 'Codex CLI' });
  });

  it('rejects an unknown agent', () => {
    expect(agentIdSchema.safeParse('codex').success).toBe(true);
    expect(agentIdSchema.safeParse('gpt').success).toBe(false);
  });
});
