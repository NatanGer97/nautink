import { initMermaid, loadMermaid } from '../../mermaid/mermaid-instance.ts';
import { enqueueMermaid } from '../../mermaid/mermaid-queue.ts';

import type { DiagramLoader, MermaidDiagram } from '@nautink/visual-core/editor-contract';
import type { Mermaid } from 'mermaid';

type GetDiagramFromText = (code: string) => Promise<unknown>;

function isFunction(value: unknown): value is GetDiagramFromText {
  return typeof value === 'function';
}

function isMermaidDiagram(value: unknown): value is MermaidDiagram {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'type') === 'string' &&
    Reflect.has(value, 'db')
  );
}

/**
 * Mermaid's `getDiagramFromText`. It is the only Mermaid API that hands back the parsed db, which
 * editors read; Mermaid marks `mermaidAPI` deprecated without a replacement for this, so it is read
 * by name and checked at run time instead of through the deprecated typed property.
 */
export function diagramReader(mermaid: Mermaid): GetDiagramFromText {
  const api: unknown = Reflect.get(mermaid, 'mermaidAPI');
  const read: unknown =
    typeof api === 'object' && api !== null ? Reflect.get(api, 'getDiagramFromText') : undefined;
  if (!isFunction(read)) {
    throw new Error('This Mermaid build has no mermaidAPI.getDiagramFromText to parse with.');
  }
  return async (code: string): Promise<unknown> => Reflect.apply(read, api, [code]);
}

/** True while the app paints its dark theme (`useAppliedTheme` sets the class). */
function isPageDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

/**
 * Parses `code` with Mermaid's own parser, through the shared queue (never beside a render).
 * Mermaid registers its diagram types when it is initialized, so the job initializes it first, in
 * the page's theme, as every render does.
 */
export const loadMermaidDiagram: DiagramLoader = async (code: string): Promise<MermaidDiagram> =>
  enqueueMermaid(async (): Promise<MermaidDiagram> => {
    const mermaid: Mermaid = await loadMermaid();
    await initMermaid(isPageDark());
    const parsed: unknown = await diagramReader(mermaid)(code);
    if (!isMermaidDiagram(parsed)) {
      throw new Error('Mermaid returned no diagram type and db for this code.');
    }
    return { type: parsed.type, db: parsed.db };
  });
