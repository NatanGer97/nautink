import { loadDiagram } from '@nautink/visual-core/diagram-loader';

import type { LoadResult } from '@nautink/visual-core/diagram-loader';
import type { DiagramLoader, ParseResult } from '@nautink/visual-core/editor-contract';

/** How to turn one diagram type's Mermaid db into an editor model. */
export interface MermaidParse<Db, Model> {
  code: string;
  load: DiagramLoader;
  type: RegExp;
  isDb: (db: unknown) => db is Db;
  build: (db: Db) => Model;
}

/** Parses with Mermaid, checks the diagram type and db shape, then builds the model. */
export async function parseWithMermaid<Db, Model>(
  request: MermaidParse<Db, Model>,
): Promise<ParseResult<Model>> {
  const loaded: LoadResult = await loadDiagram(request.code, request.load);
  if (loaded.kind !== 'ok') {
    return loaded;
  }
  const { type, db } = loaded.diagram;
  if (!request.type.test(type)) {
    return { kind: 'unsupported', message: type };
  }
  if (!request.isDb(db)) {
    return { kind: 'error', message: `Mermaid returned a ${type} diagram without the expected db` };
  }
  return buildModel(db, request.build);
}

function buildModel<Db, Model>(db: Db, build: (db: Db) => Model): ParseResult<Model> {
  try {
    return { kind: 'ok', model: build(db) };
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

/** Does `value` have a function under each of `names`? Used to check a Mermaid db's shape. */
export function hasMethods(value: unknown, names: readonly string[]): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return names.every((name: string) => typeof Reflect.get(value, name) === 'function');
}
