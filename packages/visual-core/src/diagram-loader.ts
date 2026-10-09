import type { DiagramLoader, MermaidDiagram, ParseFailure } from './editor-contract.ts';

export interface LoadSuccess {
  kind: 'ok';
  diagram: MermaidDiagram;
}

export type LoadResult = LoadSuccess | ParseFailure;

/** Runs Mermaid's parser and turns a thrown parse error into an `error` result. */
export async function loadDiagram(code: string, load: DiagramLoader): Promise<LoadResult> {
  try {
    return { kind: 'ok', diagram: await load(code) };
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
