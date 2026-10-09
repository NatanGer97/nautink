import { describe, expect, it } from 'vitest';

import {
  BASE_SYSTEM_PROMPT,
  REPO_AWARE_RULE,
  SYSTEM_PROMPT_VERSION,
  buildPrompt,
  buildSystemPrompt,
  describeSelection,
} from './prompt.ts';

describe('buildSystemPrompt', () => {
  it('is versioned and carries v1 rules', () => {
    expect(SYSTEM_PROMPT_VERSION).toBe(2);
    expect(BASE_SYSTEM_PROMPT).toContain('exactly ONE fenced ```mermaid block');
    expect(BASE_SYSTEM_PROMPT).toContain('logos:aws-lambda');
  });

  it('adds the repo-aware rule only in repo-aware mode', () => {
    expect(buildSystemPrompt(false)).toBe(BASE_SYSTEM_PROMPT);
    expect(buildSystemPrompt(false)).not.toContain('Read, Grep and Glob');
    expect(buildSystemPrompt(true)).toBe(`${BASE_SYSTEM_PROMPT}\n${REPO_AWARE_RULE}`);
  });
});

describe('buildPrompt', () => {
  it('wraps the current diagram and appends the request', () => {
    const prompt = buildPrompt({
      message: 'Add C',
      code: 'flowchart TD\n  a --> b',
      selection: null,
    });
    expect(prompt).toBe(
      'Current diagram:\n```mermaid\nflowchart TD\n  a --> b\n```\n\nRequest: Add C',
    );
  });

  it('says when the diagram is empty', () => {
    expect(buildPrompt({ message: 'Start', code: '  \n', selection: null })).toBe(
      'Current diagram: (empty)\n\nRequest: Start',
    );
  });

  it('lists the selected nodes between the diagram and the request', () => {
    const prompt = buildPrompt({
      message: 'Rename them',
      code: 'flowchart TD\n  a --> b',
      selection: { ids: ['a', 'b'], labels: ['Start', 'b'] },
    });
    expect(prompt).toBe(
      [
        'Current diagram:\n```mermaid\nflowchart TD\n  a --> b\n```',
        'Selected nodes (id: label):\n- a: "Start"\n- b\nLimit your changes to these nodes and their direct links, unless the request asks otherwise.',
        'Request: Rename them',
      ].join('\n\n'),
    );
  });
});

describe('describeSelection', () => {
  it('shows only the id when a label is missing or empty', () => {
    expect(describeSelection({ ids: ['a', 'b'], labels: [''] })).toContain('- a\n- b\n');
  });

  it('quotes labels so special characters stay readable', () => {
    expect(describeSelection({ ids: ['x'], labels: ['Say "hi"'] })).toContain(
      '- x: "Say \\"hi\\""',
    );
  });
});
