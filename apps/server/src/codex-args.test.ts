import { describe, expect, it } from 'vitest';

import { buildCodexArgs } from './codex-args.ts';
import { buildSystemPrompt } from './prompt.ts';

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

describe('buildCodexArgs', () => {
  it('starts a lean, read-only run that reads the prompt from stdin', () => {
    expect(buildCodexArgs({ sessionId: null, model: null, isRepoAware: false })).toEqual([
      'exec',
      ...leanFlags(false),
      '-',
    ]);
  });

  it('resumes a session with a model when asked', () => {
    expect(buildCodexArgs({ sessionId: 't-1', model: 'gpt-6-astra', isRepoAware: true })).toEqual([
      'exec',
      'resume',
      ...leanFlags(true),
      '-m',
      'gpt-6-astra',
      't-1',
      '-',
    ]);
  });
});
