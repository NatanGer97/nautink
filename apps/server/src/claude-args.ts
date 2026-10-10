import { buildSystemPrompt } from './prompt.ts';

export interface ClaudeArgsOptions {
  sessionId: string | null;
  model: string | null;
  isRepoAware: boolean;
}

/** The read-only tools Claude gets in repo-aware mode. */
export const REPO_TOOLS: string = 'Read,Grep,Glob';

/**
 * Keeps the context lean and the run safe: no settings from any source (so no hooks from the
 * user or from the chosen codebase's `.claude/settings.json`, which could run any command), no MCP
 * servers, no skills. v1 loaded the project's settings; Nautink loads none.
 */
const LEAN_FLAGS: readonly string[] = [
  '--setting-sources',
  '',
  '--strict-mcp-config',
  '--mcp-config',
  '{"mcpServers":{}}',
  '--disable-slash-commands',
];

function toolFlags(isRepoAware: boolean): string[] {
  return isRepoAware ? ['--tools', REPO_TOOLS, '--allowedTools', REPO_TOOLS] : ['--tools', ''];
}

/** The arguments for one headless `claude -p` run, as v1's `claudeArgs`. */
export function buildClaudeArgs(options: ClaudeArgsOptions): string[] {
  return [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--system-prompt',
    buildSystemPrompt(options.isRepoAware, 'claude'),
    ...LEAN_FLAGS,
    ...toolFlags(options.isRepoAware),
    ...(options.model === null ? [] : ['--model', options.model]),
    ...(options.sessionId === null ? [] : ['--resume', options.sessionId]),
  ];
}
