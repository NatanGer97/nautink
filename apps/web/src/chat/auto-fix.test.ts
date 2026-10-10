import { describe, expect, it } from 'vitest';

import { fixPrompt, MAX_AUTO_FIX, nextAutoFix, turnLabel } from './auto-fix.ts';

import type { AttemptResult } from './auto-fix.ts';

const PARSE_ERROR = { message: 'Parse error on line 2', line: 2 };

function attempt(overrides: Partial<AttemptResult> = {}): AttemptResult {
  return {
    status: 'done',
    code: 'flowchart TD\n  A -->',
    error: PARSE_ERROR,
    retries: 0,
    ...overrides,
  };
}

describe('nextAutoFix', () => {
  it('retries an invalid diagram up to MAX_AUTO_FIX times', () => {
    expect(MAX_AUTO_FIX).toBe(2);
    expect(nextAutoFix(attempt())).toBe(fixPrompt(PARSE_ERROR.message));
    expect(nextAutoFix(attempt({ retries: 1 }))).not.toBeNull();
    expect(nextAutoFix(attempt({ retries: 2 }))).toBeNull();
  });

  it('does not retry a valid diagram, a reply without one, or a failed or stopped reply', () => {
    expect(nextAutoFix(attempt({ error: null }))).toBeNull();
    expect(nextAutoFix(attempt({ code: null }))).toBeNull();
    expect(nextAutoFix(attempt({ status: 'stopped' }))).toBeNull();
    expect(nextAutoFix(attempt({ status: 'error' }))).toBeNull();
  });
});

describe('prompts and labels', () => {
  it('uses v1 wording', () => {
    expect(fixPrompt('Bad arrow')).toBe('The diagram fails to parse:\nBad arrow\nFix it.');
    expect(turnLabel('fix', 'x', 'Claude')).toBe('Claude: Fix syntax error');
    expect(turnLabel('auto', 'x', 'Claude')).toBe('Claude: Auto-fix syntax error');
    expect(turnLabel('user', 'Add a retry\npath', 'Claude')).toBe('Claude: Add a retry path');
    expect(turnLabel('user', 'a'.repeat(60), 'Claude')).toHaveLength('Claude: '.length + 48);
    expect(turnLabel('fix', 'x', 'Codex')).toBe('Codex: Fix syntax error');
  });
});
