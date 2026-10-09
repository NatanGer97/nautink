import { describe, expect, it } from 'vitest';

import { COMMON_ACTIONS, editorKind, quickActionsFor, TYPE_ACTIONS } from './quick-actions.ts';

function labels(code: string): string[] {
  return quickActionsFor(code).map((action) => action.label);
}

describe('quickActionsFor', () => {
  it('puts the type chips first for each visual type', () => {
    expect(labels('flowchart TD\n  A --> B').slice(0, 2)).toEqual([
      'Add error handling',
      'To sequence',
    ]);
    expect(labels('graph LR\n  A --> B')[0]).toBe('Add error handling');
    expect(labels('classDiagram\n  class A')[0]).toBe('Add methods');
    expect(labels('sequenceDiagram\n  A->>B: hi')[0]).toBe('Add error paths');
    expect(labels('erDiagram\n  A ||--o{ B : has')[0]).toBe('Add timestamps');
    expect(labels('stateDiagram-v2\n  [*] --> A')[0]).toBe('Add error states');
    expect(labels('stateDiagram\n  [*] --> A')).toHaveLength(
      TYPE_ACTIONS.state.length + COMMON_ACTIONS.length,
    );
  });

  it('shows only the common chips for code-only types', () => {
    expect(labels('pie\n  "A" : 1')).toEqual(COMMON_ACTIONS.map((action) => action.label));
    expect(editorKind('gantt\n  title x')).toBeNull();
  });

  it('shows no chips without a diagram to act on', () => {
    expect(labels('')).toEqual([]);
    expect(labels('flowchart TD')).toEqual([]);
    expect(labels('flowchart TD\n\n  %% just a comment')).toEqual([]);
  });
});
