import { describe, expect, it } from 'vitest';

import { diagramKeyword, meaningfulLines, stripPreamble, typeName } from './diagram-type.ts';

describe('diagram type', () => {
  it('names known keywords and keeps unknown ones as written', () => {
    expect(typeName('flowchart TD\n  A --> B')).toBe('Flowchart');
    expect(typeName('graph LR')).toBe('Flowchart');
    expect(typeName('sequenceDiagram\n  A->>B: hi')).toBe('Sequence');
    expect(typeName('stateDiagram-v2')).toBe('State');
    expect(typeName('zenuml\n  A.b()')).toBe('zenuml');
  });

  it('calls blank or comment-only code Empty', () => {
    expect(typeName('')).toBe('Empty');
    expect(typeName('  \n%% just a note\n')).toBe('Empty');
    expect(diagramKeyword('')).toBe('');
  });

  it('skips front matter, init directives and comments', () => {
    const code =
      '---\ntitle: Hi\n---\n%%{init: {"theme": "dark"}}%%\n%%{init: {}}%%\n%% note\npie\n  "A": 1';
    expect(stripPreamble(code).startsWith('%% note')).toBe(true);
    expect(meaningfulLines(code)).toEqual(['pie', '"A": 1']);
    expect(typeName(code)).toBe('Pie');
  });
});
