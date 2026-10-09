import { describe, expect, it } from 'vitest';

import { diffLines, diffStats } from './line-diff.ts';

describe('diffLines', () => {
  it('keeps equal code as unchanged lines', () => {
    expect(diffLines('a\nb\n', 'a\nb')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'same', text: 'b' },
    ]);
  });

  it('marks a changed line as removed, then added, between the same lines', () => {
    const lines = diffLines(
      'flowchart TD\n  A --> B\n  B --> C\n',
      'flowchart TD\n  A --> X\n  B --> C\n  C --> D\n',
    );
    expect(lines).toEqual([
      { kind: 'same', text: 'flowchart TD' },
      { kind: 'removed', text: '  A --> B' },
      { kind: 'added', text: '  A --> X' },
      { kind: 'same', text: '  B --> C' },
      { kind: 'added', text: '  C --> D' },
    ]);
    expect(diffStats(lines)).toEqual({ added: 2, removed: 1 });
  });

  it('handles empty code on either side', () => {
    expect(diffLines('', 'a')).toEqual([{ kind: 'added', text: 'a' }]);
    expect(diffLines('a\nb', '')).toEqual([
      { kind: 'removed', text: 'a' },
      { kind: 'removed', text: 'b' },
    ]);
    expect(diffLines('', '')).toEqual([]);
  });

  it('finds the longest run of shared lines', () => {
    const kinds = diffLines('x\na\nb\nc', 'a\nb\nc\ny').map((line) => line.kind);
    expect(kinds).toEqual(['removed', 'same', 'same', 'same', 'added']);
  });
});
