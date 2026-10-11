import { buildSystemPrompt } from '../../chat/prompt.ts';

export interface CodexArgsOptions {
  sessionId: string | null;
  model: string | null;
  isRepoAware: boolean;
}

/**
 * Keeps every run read-only and lean (ADR-002): no user config (MCP servers, hooks, profiles) and no
 * exec-policy rules. The system prompt goes in as developer instructions, quoted as a TOML string.
 */
function leanFlags(isRepoAware: boolean): string[] {
  return [
    '--json',
    '--skip-git-repo-check',
    '--ignore-user-config',
    '--ignore-rules',
    '-c',
    'sandbox_mode="read-only"',
    '-c',
    `developer_instructions=${JSON.stringify(buildSystemPrompt(isRepoAware, 'codex'))}`,
  ];
}

/** The arguments for one headless `codex exec` run; the prompt comes on stdin (`-`). */
export function buildCodexArgs(options: CodexArgsOptions): string[] {
  return [
    'exec',
    ...(options.sessionId === null ? [] : ['resume']),
    ...leanFlags(options.isRepoAware),
    ...(options.model === null ? [] : ['-m', options.model]),
    ...(options.sessionId === null ? [] : [options.sessionId]),
    '-',
  ];
}
