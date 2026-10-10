import { describe, expect, it } from 'vitest';

import { REPO_TOOLS, buildClaudeArgs } from './claude-args.ts';
import { buildSystemPrompt } from './prompt.ts';

const LEAN_ARGS = [
  '-p',
  '--output-format',
  'stream-json',
  '--verbose',
  '--include-partial-messages',
  '--system-prompt',
];

describe('buildClaudeArgs', () => {
  it('runs headless with v1 lean flags and no tools by default', () => {
    expect(buildClaudeArgs({ sessionId: null, model: null, isRepoAware: false })).toEqual([
      ...LEAN_ARGS,
      buildSystemPrompt(false, 'claude'),
      '--setting-sources',
      'project',
      '--strict-mcp-config',
      '--mcp-config',
      '{"mcpServers":{}}',
      '--disable-slash-commands',
      '--tools',
      '',
    ]);
  });

  it('allows read-only tools, a model and a resumed session when asked', () => {
    const args = buildClaudeArgs({ sessionId: 's-1', model: 'opus', isRepoAware: true });
    expect(args).toContain(buildSystemPrompt(true, 'claude'));
    expect(args.slice(-8)).toEqual([
      '--tools',
      REPO_TOOLS,
      '--allowedTools',
      REPO_TOOLS,
      '--model',
      'opus',
      '--resume',
      's-1',
    ]);
  });
});
