import { describe, expect, it } from 'vitest';

import { parseVersion } from './health.ts';

describe('parseVersion', () => {
  it('keeps the version number, or the first line of unexpected output', () => {
    expect(parseVersion('2.1.285 (Claude Code)\n')).toBe('2.1.285');
    expect(parseVersion('codex-cli 0.154.0\n')).toBe('0.154.0');
    expect(parseVersion('dev build\nmore')).toBe('dev build');
    expect(parseVersion('')).toBe('');
  });
});
