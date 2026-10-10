import { describe, expect, it } from 'vitest';

import {
  BASE_SYSTEM_PROMPT,
  REPO_AWARE_RULE,
  SELECTION_RULES,
  SYSTEM_PROMPT_VERSION,
  buildPrompt,
  buildSystemPrompt,
  describeSelection,
} from './prompt.ts';

describe('buildSystemPrompt', () => {
  it('is versioned and carries v1 rules', () => {
    expect(SYSTEM_PROMPT_VERSION).toBe(3);
    expect(BASE_SYSTEM_PROMPT).toContain('exactly ONE fenced ```mermaid block');
    expect(BASE_SYSTEM_PROMPT).toContain('logos:aws-lambda');
  });

  it('tells Claude to keep a selected change to the selection (PRD §4.1)', () => {
    expect(BASE_SYSTEM_PROMPT).toContain(
      'change only those items and their direct links unless the request asks for more',
    );
    expect(BASE_SYSTEM_PROMPT).toContain('Copy every other line of the current diagram exactly');
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
        ['Selected on the canvas (id: label):', '- a: "Start"', '- b', ...SELECTION_RULES].join(
          '\n',
        ),
        'Request: Rename them',
      ].join('\n\n'),
    );
  });
});

describe('describeSelection', () => {
  it('names each item by kind when kinds are sent', () => {
    expect(
      describeSelection({
        ids: ['a', 'L_a_b_0'],
        labels: ['Start', 'Start → b'],
        kinds: ['node', 'link'],
      }),
    ).toBe(
      [
        'Selected on the canvas (kind id: label):',
        '- node a: "Start"',
        '- link L_a_b_0: "Start → b"',
        ...SELECTION_RULES,
      ].join('\n'),
    );
  });

  it('falls back to the bare id when a kind is missing or empty', () => {
    const block = describeSelection({ ids: ['a', 'b', 'c'], labels: [], kinds: ['state', ''] });
    expect(block).toContain('- state a\n- b\n- c\n');
  });

  it('limits the change, keeps other lines and explains editor-only ids', () => {
    const block = describeSelection({ ids: ['a'], labels: ['A'] });
    expect(block).toContain('Limit your changes to these items and their direct links');
    expect(block).toContain('Keep every other line of the current diagram byte-identical.');
    expect(block).toContain('find that item by its label');
  });

  it('shows only the id when a label is missing or empty', () => {
    expect(describeSelection({ ids: ['a', 'b'], labels: [''] })).toContain('- a\n- b\n');
  });

  it('quotes labels so special characters stay readable', () => {
    expect(describeSelection({ ids: ['x'], labels: ['Say "hi"'] })).toContain(
      '- x: "Say \\"hi\\""',
    );
  });
});
