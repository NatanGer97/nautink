// Runs the golden fixtures in tests/golden/ (recorded from v1) through the port, so each test only
// says which port functions to call. See tests/golden/README.md for what the fixtures hold.
import { approximateTextWidth } from '@nautink/visual-core/text-measure';

import { loadMermaid } from './mermaid-loader.ts';

import type { DiagramLoader, ParseResult } from '@nautink/visual-core/editor-contract';
import type { Position, PositionMap } from '@nautink/visual-core/positions';

/** What a parse→serialize round trip produced: the code, or why there is no model. */
export interface RoundTripResult {
  kind: string;
  code?: string;
  message?: string;
}

export interface RoundTripCase {
  name: string;
  code: string;
  expected: RoundTripResult;
}

/** One edit: a port op name, its arguments after the model, and the code it leads to (null: the op returned null). */
export interface OpStep {
  op: string;
  args: unknown[];
  expected: string | null;
}

export interface OpCase {
  name: string;
  code: string;
  steps: OpStep[];
}

export interface Placed {
  positions: PositionMap;
  isFullLayout?: boolean;
}

export interface LayoutCase {
  name: string;
  kind: string;
  code: string;
  start?: PositionMap;
  expected: unknown;
}

export interface GoldenFile {
  editor: string;
  mappings: string[];
  roundTrip: RoundTripCase[];
  ops: OpCase[];
  layouts: LayoutCase[];
}

/** The parse/serialize pair and the op modules of one editor. */
export interface GoldenEditor<Model> {
  parse: (code: string, load: DiagramLoader) => Promise<ParseResult<Model>>;
  serialize: (model: Model) => string;
  /** Module namespaces whose exports are the ops named in the fixtures. */
  ops: readonly object[];
  /** Item ids in walk order, for `{ "$item": n }` references (sequence only). */
  itemIds?: (model: Model) => string[];
}

/** v1's DOM-free text width (7px per character); the fixtures were measured with it. */
export function measure(text: string): number {
  return approximateTextWidth(text);
}

export async function roundTrip<Model>(
  editor: GoldenEditor<Model>,
  code: string,
): Promise<RoundTripResult> {
  const result: ParseResult<Model> = await editor.parse(code, loadMermaid);
  if (result.kind !== 'ok') {
    return { kind: result.kind, message: result.message };
  }
  return { kind: 'ok', code: editor.serialize(result.model) };
}

export async function parseModel<Model>(editor: GoldenEditor<Model>, code: string): Promise<Model> {
  const result: ParseResult<Model> = await editor.parse(code, loadMermaid);
  if (result.kind !== 'ok') {
    throw new Error(`${result.kind}: ${result.message}`);
  }
  return result.model;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Replaces `{ "$item": n }` with the n-th item id and `{ "$section": [n, s] }` with `<id>:<s>`. */
export function resolveRefs(value: unknown, ids: readonly string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((entry: unknown) => resolveRefs(entry, ids));
  }
  if (!isRecord(value)) {
    return value;
  }
  const keys: string[] = Object.keys(value);
  if (keys.length === 1 && typeof value.$item === 'number') {
    return ids[value.$item];
  }
  if (keys.length === 1 && Array.isArray(value.$section)) {
    const [index, section] = value.$section as [number, number];
    return `${String(ids[index])}:${String(section)}`;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]: [string, unknown]) => [key, resolveRefs(entry, ids)]),
  );
}

/** Ops return a model, `{ model, id }`, `{ graph, id }`, or null; this keeps the model. */
function editedModel(result: unknown): unknown {
  if (isRecord(result) && 'id' in result && 'model' in result) {
    return result.model;
  }
  if (isRecord(result) && 'id' in result && 'graph' in result) {
    return result.graph;
  }
  return result;
}

function applyOp(modules: readonly object[], step: OpStep, args: readonly unknown[]): unknown {
  const owner: object | undefined = modules.find((module: object) => step.op in module);
  const op: unknown = owner ? Reflect.get(owner, step.op) : undefined;
  if (typeof op !== 'function') {
    throw new Error(`The port has no op named ${step.op}`);
  }
  const result: unknown = Reflect.apply(op, undefined, args);
  return editedModel(result);
}

/** Applies each step to the model the previous one left, and returns the code after each. */
export async function runSteps<Model>(
  editor: GoldenEditor<Model>,
  golden: OpCase,
): Promise<(string | null)[]> {
  let model: Model = await parseModel(editor, golden.code);
  const codes: (string | null)[] = [];
  for (const step of golden.steps) {
    const ids: string[] = editor.itemIds ? editor.itemIds(model) : [];
    const args: unknown = resolveRefs(step.args, ids);
    const next: unknown = applyOp(editor.ops, step, [model, ...(args as unknown[])]);
    if (next === null) {
      codes.push(null);
      continue;
    }
    model = next as Model;
    codes.push(editor.serialize(model));
  }
  return codes;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Positions rounded to 2 decimals, as the fixtures store them. */
export function rounded(positions: PositionMap): PositionMap {
  return Object.fromEntries(
    Object.entries(positions).map(([id, position]: [string, Position]) => [
      id,
      {
        x: round(position.x),
        y: round(position.y),
        ...(position.l === undefined ? {} : { l: position.l }),
      },
    ]),
  );
}

/** A copy of the stored start positions, so a port bug that mutates them cannot leak. */
export function copyPositions(positions: PositionMap | undefined): PositionMap {
  if (positions === undefined) {
    throw new Error('A place case needs start positions');
  }
  return Object.fromEntries(
    Object.entries(positions).map(([id, position]: [string, Position]) => [id, { ...position }]),
  );
}

/** Layout output as the fixtures store it: model objects by id, numbers rounded, no `undefined`. */
export function normalizeLayout(value: unknown): unknown {
  if (typeof value === 'number') {
    return round(value);
  }
  if (Array.isArray(value)) {
    return value.map(normalizeLayout);
  }
  if (!isRecord(value)) {
    return value;
  }
  const entries: [string, unknown][] = Object.entries(value).flatMap(
    ([key, entry]: [string, unknown]): [string, unknown][] => {
      if (key === 'p' || entry === undefined) {
        return [];
      }
      if ((key === 'item' || key === 'box') && isRecord(entry)) {
        return [[key, entry.id]];
      }
      return [[key, normalizeLayout(entry)]];
    },
  );
  return Object.fromEntries(entries);
}
