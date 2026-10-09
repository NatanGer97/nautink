import { describe, expect, it } from 'vitest';

import { detectType, EDITORS } from './detect.ts';

describe('detectType', () => {
  it.each([
    ['flowchart TD\n a --> b', 'flow', 'flowchart'],
    ['graph LR\n a', 'flow', 'graph'],
    ['classDiagram\n class A', 'class', 'classDiagram'],
    ['classDiagram-v2', 'class', 'classDiagram-v2'],
    ['sequenceDiagram', 'sequence', 'sequenceDiagram'],
    ['erDiagram', 'er', 'erDiagram'],
    ['stateDiagram-v2', 'state', 'stateDiagram-v2'],
    ['stateDiagram', 'state', 'stateDiagram'],
  ])('picks the editor for %j', (code, editor, keyword) => {
    expect(detectType(code)).toEqual({ editor, keyword, isEmpty: false });
  });

  it('skips the preamble and comments', () => {
    const code = '---\ntitle: x\n---\n%%{init: {}}%%\n%% note\n\n  erDiagram\n';
    expect(detectType(code)).toEqual({ editor: 'er', keyword: 'erDiagram', isEmpty: false });
  });

  it('returns no editor for other diagram types', () => {
    expect(detectType('pie title Pets')).toEqual({ editor: null, keyword: 'pie', isEmpty: false });
  });

  it('flags empty code', () => {
    expect(detectType('  \n%% only a comment\n')).toEqual({
      editor: null,
      keyword: '',
      isEmpty: true,
    });
  });

  it('has a template for every editor that detects back to it', () => {
    for (const [id, info] of Object.entries(EDITORS)) {
      expect(detectType(info.template).editor).toBe(id);
    }
  });
});
