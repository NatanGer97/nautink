import { beforeEach, describe, expect, it } from 'vitest';

import {
  changeLabel,
  diagramIdOf,
  diffSpan,
  ensureModel,
  errorMarkers,
  modelUri,
  syncModel,
  toEditSelection,
} from './editor-binding.ts';
import { fakeMonaco, resetFakeMonaco } from '../../tests/fake-monaco.ts';

import type { MonacoApi } from './monaco-setup.ts';
import type { editor } from 'monaco-editor/editor/editor.api.js';

const monaco = fakeMonaco as unknown as MonacoApi;

beforeEach(() => {
  resetFakeMonaco();
});

describe('diffSpan', () => {
  it('finds the smallest single edit', () => {
    expect(diffSpan('abcdef', 'abXYef')).toEqual([2, 4, 4]);
    expect(diffSpan('abc', 'abc')).toEqual([3, 3, 3]);
    expect(diffSpan('abc', 'abcd')).toEqual([3, 3, 4]);
    expect(diffSpan('aaa', 'aa')).toEqual([2, 3, 2]);
  });
});

describe('models', () => {
  it('keeps one model per diagram and reads the id back', () => {
    const model = ensureModel(monaco, 'd1', 'flowchart TD');
    expect(ensureModel(monaco, 'd1', 'ignored')).toBe(model);
    expect(model.getValue()).toBe('flowchart TD');
    expect(diagramIdOf(model)).toBe('d1');
    expect(modelUri(monaco, 'd2').path).toBe('/d2.mmd');
    const other = fakeMonaco.editor.createModel('x', 'mermaid', {
      scheme: 'inmemory',
      authority: 'other',
      path: '/x',
      toString: () => 'inmemory://other/x',
    });
    expect(diagramIdOf(other as unknown as editor.ITextModel)).toBeNull();
  });

  it('syncs code into the model as one minimal edit', () => {
    const model = ensureModel(monaco, 'd1', 'flowchart TD\n  a --> b\n  c');
    expect(syncModel(model, 'flowchart TD\n  a --> b\n  c')).toBe(-1);
    const end = syncModel(model, 'flowchart TD\n  a --> x\n  c');
    expect(model.getValue()).toBe('flowchart TD\n  a --> x\n  c');
    expect(end).toBe(22);
  });
});

describe('markers and labels', () => {
  it('marks the failing line, clamped to the model', () => {
    const model = ensureModel(monaco, 'd1', 'flowchart TD\n  a -->');
    expect(errorMarkers(monaco, model, null)).toEqual([]);
    expect(errorMarkers(monaco, model, { message: 'bad', line: 2 })[0]).toMatchObject({
      severity: 8,
      message: 'bad',
      startLineNumber: 2,
      endColumn: 8,
    });
    expect(errorMarkers(monaco, model, { message: 'bad', line: 40 })[0]?.startLineNumber).toBe(2);
    expect(errorMarkers(monaco, model, { message: 'bad', line: null })[0]?.startLineNumber).toBe(1);
  });

  it('names each kind of change and converts a selection', () => {
    expect(changeLabel('typing')).toBe('Typed in code');
    expect(changeLabel('paste')).toBe('Pasted code');
    expect(changeLabel('cut')).toBe('Cut code');
    expect(changeLabel('drop')).toBe('Moved code');
    expect(
      toEditSelection({
        selectionStartLineNumber: 1,
        selectionStartColumn: 2,
        positionLineNumber: 3,
        positionColumn: 4,
      }),
    ).toEqual({ anchorLine: 1, anchorCol: 2, line: 3, col: 4 });
  });
});
