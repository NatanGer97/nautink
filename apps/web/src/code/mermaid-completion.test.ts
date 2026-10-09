import { describe, expect, it } from 'vitest';

import { mermaidSuggestions } from './mermaid-completion.ts';

import type { CompletionContext } from './mermaid-completion.ts';

/** The context with the cursor at the end of `lines`' last line (word = the trailing word). */
function at(lines: string[]): CompletionContext {
  const last = lines.at(-1) ?? '';
  const word = /\w*$/.exec(last)?.[0] ?? '';
  return {
    lines,
    lineNumber: lines.length,
    column: last.length + 1,
    wordStartColumn: last.length + 1 - word.length,
    wordEndColumn: last.length + 1,
  };
}

describe('mermaidSuggestions', () => {
  it('offers diagram starters on the first line and for unknown types', () => {
    const starters = mermaidSuggestions(at(['flo']));
    expect(starters[0]).toMatchObject({ label: 'flowchart TD', kind: 'starter', startColumn: 1 });
    expect(starters[0]?.insertText).toBe('flowchart TD\n');
    expect(mermaidSuggestions(at(['gantt', '  sec']))[0]?.kind).toBe('starter');
    expect(mermaidSuggestions(at(['%% note', '---', 'flo']))[0]?.kind).toBe('starter');
  });

  it('offers the snippets of the diagram type, as Monaco snippets', () => {
    const items = mermaidSuggestions(at(['sequenceDiagram', '  lo']));
    expect(items.map((item) => item.label)).toContain('loop');
    const loop = items.find((item) => item.label === 'loop');
    expect(loop).toMatchObject({ kind: 'snippet', isSnippet: true, startColumn: 3 });
    expect(mermaidSuggestions(at(['erDiagram', '  ']))[0]?.label).toBe('entity');
    expect(mermaidSuggestions(at(['stateDiagram-v2', '  ']))[0]?.label).toBe('[*] -->');
    expect(mermaidSuggestions(at(['classDiagram', '  ']))[0]?.label).toBe('class');
  });

  it('replaces arrow characters already typed', () => {
    const items = mermaidSuggestions(at(['flowchart TD', '  A --']));
    const arrow = items.find((item) => item.label === '-->');
    expect(arrow).toMatchObject({ kind: 'operator', startColumn: 5, endColumn: 7 });
    const sub = items.find((item) => item.label === 'subgraph');
    expect(sub).toMatchObject({ kind: 'snippet', startColumn: 7 });
  });

  it('offers shape names inside @{ shape: }', () => {
    const items = mermaidSuggestions(at(['flowchart TD', '  A@{ shape: ro']));
    expect(items[0]).toMatchObject({ label: 'rect', kind: 'shape', detail: 'Process' });
    expect(items[0]?.startColumn).toBe(14);
    expect(items.map((item) => item.label)).toContain('rounded');
  });

  it('offers icon pack prefixes inside icon: "', () => {
    const items = mermaidSuggestions(at(['flowchart TD', '  A@{ icon: "lo']));
    expect(items.map((item) => item.label)).toEqual([
      'mdi:',
      'logos:',
      'fa6-solid:',
      'fa6-brands:',
      'carbon:',
    ]);
    expect(items[1]).toMatchObject({ kind: 'iconPack', detail: 'Tech logos', startColumn: 14 });
  });
});
