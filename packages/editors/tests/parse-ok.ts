import { loadMermaid } from './mermaid-loader.ts';

import type { DiagramLoader, ParseResult } from '@nautink/visual-core/editor-contract';

/** Parses with real Mermaid and returns the model, failing the test on any other result. */
export async function parseOk<Model>(
  parse: (code: string, load: DiagramLoader) => Promise<ParseResult<Model>>,
  code: string,
): Promise<Model> {
  const result: ParseResult<Model> = await parse(code, loadMermaid);
  if (result.kind !== 'ok') {
    throw new Error(`${result.kind}: ${result.message}`);
  }
  return result.model;
}

/** A loader that returns a hand-made db, for testing what parsing does with fields Mermaid omits. */
export function fakeLoader(type: string, db: unknown): DiagramLoader {
  return async () => Promise.resolve({ type, db });
}
