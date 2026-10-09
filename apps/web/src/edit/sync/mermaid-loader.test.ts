import { describe, expect, it } from 'vitest';

import { diagramReader, loadMermaidDiagram } from './mermaid-loader.ts';

import type { Mermaid } from 'mermaid';

describe('loadMermaidDiagram', () => {
  it("parses with Mermaid's own parser and hands back the type and db", async () => {
    const diagram = await loadMermaidDiagram('flowchart TD\n  A[Start] --> B[Done]');
    expect(diagram.type).toMatch(/^flowchart/);
    expect(typeof Reflect.get(diagram.db as object, 'getVertices')).toBe('function');
  });

  it('throws the parse error for invalid code', async () => {
    await expect(loadMermaidDiagram('flowchart TD\n  A -->')).rejects.toThrow();
  });
});

describe('diagramReader', () => {
  it('names what is missing when the Mermaid build has no getDiagramFromText', () => {
    const broken = { mermaidAPI: {} } as unknown as Mermaid;
    expect(() => diagramReader(broken)).toThrow(/getDiagramFromText/);
    expect(() => diagramReader({} as unknown as Mermaid)).toThrow(/getDiagramFromText/);
  });

  it('rejects a parse result without a type and db', async () => {
    const odd = {
      mermaidAPI: { getDiagramFromText: async (): Promise<unknown> => Promise.resolve(null) },
    } as unknown as Mermaid;
    await expect(diagramReader(odd)('x')).resolves.toBeNull();
  });
});
