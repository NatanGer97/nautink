// State diagram <-> editor model. Parsing walks Mermaid's own document tree (see parse.ts);
// serializing writes Mermaid source back, scope by scope.
import { splitPreamble } from '@nautink/visual-core/preamble';

import { StateWalker, stateAliases } from './parse.ts';
import { nodeScope, pseudoOf, regionScopes, stateById } from './scopes.ts';
import { hasMethods, parseWithMermaid } from '../shared/mermaid-parse.ts';
import { textAt } from '../shared/values.ts';

import type { DbStatement, WalkResult } from './parse.ts';
import type {
  Pseudo,
  StateHeader,
  StateModel,
  StateNode,
  StateNote,
  StateStyle,
  StateTransition,
} from './types.ts';
import type {
  DiagramLoader,
  EditorModule,
  ParseResult,
} from '@nautink/visual-core/editor-contract';

const INDENT: string = '    ';
const KEEP_RE: RegExp = /^\s*(classDef|click|accTitle|accDescr)\b/;

export function emptyModel(): StateModel {
  return {
    header: 'stateDiagram-v2',
    preamble: '',
    direction: '',
    states: [],
    transitions: [],
    notes: [],
    pseudo: [],
    styles: [],
    extra: [],
  };
}

/** Numbers notes per target: `note:<target>:<n>`. */
export function assignNoteIds(model: StateModel): StateModel {
  const counts: Map<string, number> = new Map<string, number>();
  const notes: StateNote[] = model.notes.map((note: StateNote) => {
    const index: number = (counts.get(note.target) ?? -1) + 1;
    counts.set(note.target, index);
    return { ...note, id: `note:${note.target}:${String(index)}` };
  });
  return { ...model, notes };
}

// ---- parse ----

interface StateDb {
  rootDoc?: DbStatement[];
  getRootDocV2?: () => { doc?: DbStatement[] };
}

function isStateDb(db: unknown): db is StateDb {
  return (
    typeof db === 'object' &&
    db !== null &&
    (Array.isArray(Reflect.get(db, 'rootDoc')) || hasMethods(db, ['getRootDocV2']))
  );
}

// The v2 db translates the tree on parse; an untranslated tree still has raw `[*]` ids.
function rootDoc(db: StateDb): DbStatement[] {
  const root: DbStatement[] = db.rootDoc ?? [];
  if (JSON.stringify(root).includes('"[*]"') && db.getRootDocV2) {
    return db.getRootDocV2().doc ?? [];
  }
  return root;
}

function headerOf(body: string): StateHeader {
  const line: string =
    body
      .split('\n')
      .map((text: string) => text.trim())
      .find((text: string) => text && !text.startsWith('%%')) ?? '';
  return /^stateDiagram\b(?!-v2)/.test(line) ? 'stateDiagram' : 'stateDiagram-v2';
}

function blockEnd(lines: readonly string[], start: number): number {
  let end: number = start;
  while (end + 1 < lines.length && !textAt(lines, end).includes('}')) {
    end++;
  }
  return end;
}

// Kept lines, multi-line `accDescr { ... }` blocks included.
function keepLines(body: string): string[] {
  const out: string[] = [];
  const lines: string[] = body.split('\n');
  for (let index: number = 0; index < lines.length; index++) {
    const line: string = textAt(lines, index);
    if (!KEEP_RE.test(line)) {
      continue;
    }
    const end: number = /^\s*accDescr\s*\{/.test(line) ? blockEnd(lines, index) : index;
    out.push(
      lines
        .slice(index, end + 1)
        .map((part: string) => part.trim())
        .join('\n'),
    );
    index = end;
  }
  return out;
}

function modelFromDb(db: StateDb, code: string): StateModel {
  const { preamble, body } = splitPreamble(code);
  const walked: WalkResult = new StateWalker(stateAliases(body)).walk(rootDoc(db), null).result();
  return assignNoteIds({
    ...emptyModel(),
    ...walked,
    preamble,
    header: headerOf(body),
    extra: keepLines(body),
  });
}

/** Mermaid state diagram source to a model. Empty code is an empty model. */
export async function parse(code: string, load: DiagramLoader): Promise<ParseResult<StateModel>> {
  if (!code.trim()) {
    return { kind: 'ok', model: emptyModel() };
  }
  return parseWithMermaid({
    code,
    load,
    type: /^state/,
    isDb: isStateDb,
    build: (db: StateDb): StateModel => modelFromDb(db, code),
  });
}

// ---- serialize ----

/** The scope a transition must be written in. */
export function transitionScope(model: StateModel, transition: StateTransition): string | null {
  const pseudo: Pseudo | null = pseudoOf(transition.from) ?? pseudoOf(transition.to);
  if (pseudo) {
    return pseudo.scope;
  }
  const from: string | null = nodeScope(model, transition.from);
  return from === nodeScope(model, transition.to) ? from : null;
}

function quoteName(text: string): string {
  return `"${text.replace(/"/g, '#quot;')}"`;
}

function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ').trim();
}

function endpoint(id: string): string {
  return pseudoOf(id) ? '[*]' : id;
}

function transitionLine(transition: StateTransition): string {
  const label: string = oneLine(transition.label);
  return `${endpoint(transition.from)} --> ${endpoint(transition.to)}${label ? ` : ${label}` : ''}`;
}

interface EmitContext {
  model: StateModel;
  byScope: Map<string, StateTransition[]>;
  touched: Set<string>;
}

function transitionsByScope(model: StateModel): Map<string, StateTransition[]> {
  const byScope: Map<string, StateTransition[]> = new Map<string, StateTransition[]>();
  for (const transition of model.transitions) {
    const key: string = transitionScope(model, transition) ?? '';
    byScope.set(key, [...(byScope.get(key) ?? []), transition]);
  }
  return byScope;
}

// States that a transition already writes in their own scope (or anywhere, for top-level states).
function touchedStates(model: StateModel): Set<string> {
  const touched: Set<string> = new Set<string>();
  for (const transition of model.transitions) {
    const scope: string | null = transitionScope(model, transition);
    for (const id of [transition.from, transition.to].filter((end: string) => !pseudoOf(end))) {
      const parent: string | null = stateById(model, id)?.parent ?? null;
      if (scope === parent || parent === null) {
        touched.add(id);
      }
    }
  }
  return touched;
}

function declarationLines(state: StateNode): string[] {
  if (state.type !== 'state') {
    return [`state ${state.id} <<${state.type}>>`];
  }
  const desc: string[] = state.desc.map(oneLine).filter(Boolean);
  const name: string = oneLine(state.name);
  const alias: string[] = [];
  if (name && (name !== state.id || desc.length)) {
    alias.push(`state ${quoteName(name)} as ${state.id}`);
  }
  return [...alias, ...desc.map((line: string) => `${state.id} : ${line}`)];
}

function leafLines(context: EmitContext, state: StateNode): string[] {
  const lines: string[] = declarationLines(state);
  return lines.length === 0 && !context.touched.has(state.id) ? [state.id] : lines;
}

// Initial/final transitions into deeper scopes go before the nested blocks, so the deeper block
// stays the last (parent-defining) occurrence for Mermaid.
function isDeep(model: StateModel, transition: StateTransition, scope: string | null): boolean {
  const other: string = pseudoOf(transition.from) ? transition.to : transition.from;
  return scope !== null && !pseudoOf(other) && nodeScope(model, other) !== scope;
}

function regionLines(context: EmitContext, state: StateNode, inner: string): string[] {
  return regionScopes(state.id, state.regions).flatMap((scope: string, index: number) => [
    ...(index > 0 ? [`${inner}--`] : []),
    ...scopeLines(context, scope, inner),
  ]);
}

function compositeLines(context: EmitContext, state: StateNode, indent: string): string[] {
  const name: string = oneLine(state.name);
  const inner: string = indent + INDENT;
  const alias: string = name && name !== state.id ? `${quoteName(name)} as ` : '';
  return [
    `${indent}state ${alias}${state.id} {`,
    ...(state.dir ? [`${inner}direction ${state.dir}`] : []),
    ...(state.regions > 0
      ? regionLines(context, state, inner)
      : scopeLines(context, state.id, inner)),
    `${indent}}`,
  ];
}

function noteLines(note: StateNote, indent: string): string[] {
  const lines: string[] = note.text
    .split('\n')
    .map((line: string) => line.trim())
    .filter(
      (line: string, index: number, all: string[]) => line || (index > 0 && index < all.length - 1),
    );
  if (lines.length <= 1) {
    const text: string = lines[0] ?? '';
    return [`${indent}note ${note.side} of ${note.target} : ${text === '' ? ' ' : text}`];
  }
  return [
    `${indent}note ${note.side} of ${note.target}`,
    ...lines.map((line: string) => `${indent}${INDENT}${line}`),
    `${indent}end note`,
  ];
}

function transitionLines(
  context: EmitContext,
  scope: string | null,
  indent: string,
): { deep: string[]; rest: string[] } {
  const transitions: StateTransition[] = context.byScope.get(scope ?? '') ?? [];
  const lines = (isDeepWanted: boolean): string[] =>
    transitions
      .filter(
        (transition: StateTransition) => isDeep(context.model, transition, scope) === isDeepWanted,
      )
      .map((transition: StateTransition) => indent + transitionLine(transition));
  return { deep: lines(true), rest: lines(false) };
}

function memberLines(
  context: EmitContext,
  members: readonly StateNode[],
  indent: string,
): { leaves: string[]; composites: string[] } {
  return {
    leaves: members
      .filter((state: StateNode) => !state.isComposite)
      .flatMap((state: StateNode) =>
        leafLines(context, state).map((line: string) => indent + line),
      ),
    composites: members
      .filter((state: StateNode) => state.isComposite)
      .flatMap((state: StateNode) => compositeLines(context, state, indent)),
  };
}

function scopeLines(context: EmitContext, scope: string | null, indent: string): string[] {
  const members: StateNode[] = context.model.states.filter(
    (state: StateNode) => state.parent === scope,
  );
  const ids: Set<string> = new Set<string>(members.map((state: StateNode) => state.id));
  const { leaves, composites } = memberLines(context, members, indent);
  const { deep, rest } = transitionLines(context, scope, indent);
  const notes: string[] = context.model.notes
    .filter((note: StateNote) => ids.has(note.target))
    .flatMap((note: StateNote) => noteLines(note, indent));
  return [...leaves, ...deep, ...composites, ...rest, ...notes];
}

function classLines(model: StateModel): string[] {
  const byClass: Record<string, string[]> = {};
  for (const state of model.states) {
    for (const name of state.classes) {
      byClass[name] = [...(byClass[name] ?? []), state.id];
    }
  }
  return Object.entries(byClass).map(
    ([name, ids]: [string, string[]]) => `${INDENT}class ${ids.join(',')} ${name}`,
  );
}

function styleLines(model: StateModel): string[] {
  return model.styles
    .filter((style: StateStyle) => style.ids.length > 0)
    .map((style: StateStyle) => `${INDENT}style ${style.ids.join(',')} ${style.css}`);
}

/** The model as Mermaid source. */
export function serialize(model: StateModel): string {
  const context: EmitContext = {
    model,
    byScope: transitionsByScope(model),
    touched: touchedStates(model),
  };
  const lines: string[] = [
    ...(model.preamble ? [model.preamble.trimEnd()] : []),
    model.header,
    ...(model.direction ? [`${INDENT}direction ${model.direction}`] : []),
    ...scopeLines(context, null, INDENT),
    ...model.extra.map((line: string) => INDENT + line),
    ...classLines(model),
    ...styleLines(model),
  ];
  return `${lines.join('\n')}\n`;
}

export const stateEditor: EditorModule<StateModel> = { id: 'state', emptyModel, parse, serialize };
