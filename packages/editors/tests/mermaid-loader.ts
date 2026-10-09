import mermaid from 'mermaid';

import type { DiagramLoader, MermaidDiagram } from '@nautink/visual-core/editor-contract';

mermaid.initialize({ startOnLoad: false });

/** The loader the web app will pass: Mermaid's own parser, returning the diagram type and db. */
export const loadMermaid: DiagramLoader = async (code: string): Promise<MermaidDiagram> => {
  // getDiagramFromText is the only Mermaid API that returns the parsed db, which editors read.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- see above
  const diagram = await mermaid.mermaidAPI.getDiagramFromText(code);
  return { type: diagram.type, db: diagram.db };
};
