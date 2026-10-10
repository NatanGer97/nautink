// Mermaid's own flowchart parser, outside the browser: Mermaid sanitizes labels with DOMPurify,
// which needs a `window`, so a jsdom one is installed before Mermaid loads.
import { flowEditor } from '@nautink/editors/flow/model';

import type { FlowGraph } from '@nautink/editors/flow/model';
import type { Mermaid } from 'mermaid';

type Loader = Parameters<typeof flowEditor.parse>[1];
type Parsed = Awaited<ReturnType<typeof flowEditor.parse>>;
type ReadDiagram = (code: string) => Promise<unknown>;

let reading: Promise<ReadDiagram> | null = null;

/**
 * Mermaid's `getDiagramFromText`, the only API that hands back the parsed db. Mermaid marks
 * `mermaidAPI` deprecated without a replacement for this, so it is read by name, as the web app's
 * `diagramReader` does.
 */
function diagramReader(mermaid: Mermaid): ReadDiagram {
  const api: unknown = Reflect.get(mermaid, 'mermaidAPI');
  const read: unknown =
    typeof api === 'object' && api !== null ? Reflect.get(api, 'getDiagramFromText') : undefined;
  if (typeof read !== 'function') {
    throw new Error('This Mermaid build has no mermaidAPI.getDiagramFromText to parse with.');
  }
  return async (code: string): Promise<unknown> =>
    Promise.resolve(Reflect.apply(read, api, [code]));
}

function property(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, name) : undefined;
}

/**
 * A jsdom `window` and `document` on `globalThis`. jsdom is loaded untyped on purpose: its typings
 * package brings its own `fetch` types, which clash with Node's in this project.
 */
async function installWindow(): Promise<void> {
  const specifier: string = 'jsdom';
  const jsdom: unknown = await import(specifier);
  const Dom: unknown = property(jsdom, 'JSDOM');
  if (typeof Dom !== 'function') {
    throw new Error('jsdom has no JSDOM export.');
  }
  const dom: unknown = Reflect.construct(Dom, ['<!doctype html><html><body></body></html>']);
  const window: unknown = property(dom, 'window');
  Object.assign(globalThis, { window, document: property(window, 'document') });
}

async function loadReader(): Promise<ReadDiagram> {
  if (!('document' in globalThis)) {
    await installWindow();
  }
  const mermaid: Mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false });
  return diagramReader(mermaid);
}

const load: Loader = async (code: string) => {
  reading ??= loadReader();
  const diagram: unknown = await (await reading)(code);
  if (typeof diagram !== 'object' || diagram === null) {
    throw new Error('Mermaid returned no diagram.');
  }
  return { type: String(Reflect.get(diagram, 'type')), db: Reflect.get(diagram, 'db') };
};

/** Parses a flowchart into the editor's graph. Throws when the code is not a valid flowchart. */
export async function parseFlow(code: string): Promise<FlowGraph> {
  const result: Parsed = await flowEditor.parse(code, load);
  if (result.kind !== 'ok') {
    throw new Error(`Not a valid flowchart (${result.kind}): ${result.message}`);
  }
  return result.model;
}
