// Builds the state model by walking the document tree that Mermaid's own state parser builds
// (db.rootDoc). Mermaid keeps the last non-top-level scope of a state as its parent.
import { decodeText } from '@nautink/visual-core/text';

import { endId, regionOf, regionScope, startId } from './scopes.ts';

import type {
  StateDirection,
  StateNode,
  StateNote,
  StateStyle,
  StateTransition,
  StateType,
} from './types.ts';

export const TYPES: readonly StateType[] = ['state', 'choice', 'fork', 'join'];
const DIRECTIONS: readonly StateDirection[] = ['TB', 'BT', 'LR', 'RL'];

/** One statement of Mermaid's state document tree, as far as parsing reads it. */
export interface DbStatement {
  stmt?: string;
  id?: string;
  type?: string;
  description?: string | string[];
  // `true` for a start `[*]`, `false` for an end; absent on real states.
  start?: unknown;
  classes?: string[];
  note?: { text: string; position?: string };
  doc?: DbStatement[];
  state1?: DbStatement;
  state2?: DbStatement;
  value?: string;
  styleClass?: string;
}

/** What the walk collects; header, preamble and kept lines come from the source text. */
export interface WalkResult {
  direction: StateDirection;
  states: StateNode[];
  transitions: StateTransition[];
  notes: StateNote[];
  styles: StateStyle[];
}

/** Text Mermaid stores (string or list of strings), with its entities decoded. */
export function decodeDb(value: string | string[] | undefined): string {
  return decodeText(Array.isArray(value) ? value.join(',') : (value ?? ''));
}

function directionOf(value: string | undefined): StateDirection {
  const direction: StateDirection | undefined = DIRECTIONS.find(
    (known: StateDirection) => known === value,
  );
  if (direction === undefined) {
    throw new Error(`Unknown state diagram direction "${value ?? ''}"`);
  }
  return direction;
}

function isDivider(statement: DbStatement): boolean {
  return statement.type === 'divider';
}

// Composite docs with `--` come back as divider states (each with its own doc), or, when the
// last region is empty, as raw divider markers between statements.
export function splitRegions(doc: readonly DbStatement[]): DbStatement[][] | null {
  if (!doc.some(isDivider)) {
    return null;
  }
  if (doc.every((statement: DbStatement) => isDivider(statement) && Array.isArray(statement.doc))) {
    return doc.map((statement: DbStatement) => statement.doc ?? []);
  }
  const regions: DbStatement[][] = [[]];
  for (const statement of doc) {
    const current: DbStatement[] = regions.at(-1) ?? [];
    current.push(...(isDivider(statement) ? (statement.doc ?? []) : [statement]));
    if (isDivider(statement)) {
      regions.push([]);
    }
  }
  const filled: DbStatement[][] = regions.filter((region: DbStatement[]) => region.length > 0);
  return filled.length > 1 ? filled : null;
}

type StatementHandler = (statement: DbStatement, scope: string | null) => void;

const ALIAS_RE: RegExp = /^\s*state\s+"([^"]*)"\s+as\s+([^\s{]+)/;

/**
 * State id → its display name from `state "Name" as Id`. Mermaid's tree stores that name and every
 * `Id : text` description alike, so only the source tells a display name from a description.
 */
export function stateAliases(body: string): Map<string, string> {
  const aliases: Map<string, string> = new Map<string, string>();
  for (const line of body.split('\n')) {
    const match: RegExpExecArray | null = ALIAS_RE.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined && !aliases.has(match[2])) {
      aliases.set(match[2], decodeDb(match[1]).trim());
    }
  }
  return aliases;
}

/** `list` without its first `item`. */
function withoutOne(list: readonly string[], item: string): string[] {
  const index: number = list.indexOf(item);
  return index < 0 ? [...list] : [...list.slice(0, index), ...list.slice(index + 1)];
}

/** Walks Mermaid's document tree into states, transitions, notes and styles. */
export class StateWalker {
  readonly #result: WalkResult = {
    direction: '',
    states: [],
    transitions: [],
    notes: [],
    styles: [],
  };
  readonly #byId: Map<string, StateNode> = new Map<string, StateNode>();
  readonly #descriptions: Map<string, string[]> = new Map<string, string[]>();
  readonly #aliases: ReadonlyMap<string, string>;

  /** `aliases`: display names from `state "Name" as Id` (see `stateAliases`). */
  constructor(aliases: ReadonlyMap<string, string> = new Map<string, string>()) {
    this.#aliases = aliases;
  }

  walk(doc: readonly DbStatement[], scope: string | null): this {
    for (const statement of doc) {
      this.#statement(statement, scope);
    }
    return this;
  }

  /** The walk's result, with names and descriptions settled from the collected descriptions. */
  result(): WalkResult {
    return {
      ...this.#result,
      states: this.#result.states.map((state: StateNode) => this.#named(state)),
    };
  }

  readonly #handlers: Readonly<Record<string, StatementHandler>> = {
    dir: (statement: DbStatement, scope: string | null): void => {
      this.#direction(statement, scope);
    },
    relation: (statement: DbStatement, scope: string | null): void => {
      this.#relation(statement, scope);
    },
    state: (statement: DbStatement, scope: string | null): void => {
      this.#state(statement, scope);
    },
    default: (statement: DbStatement, scope: string | null): void => {
      this.#state(statement, scope);
    },
    applyClass: (statement: DbStatement): void => {
      this.#applyClass(statement);
    },
    style: (statement: DbStatement): void => {
      this.#style(statement);
    },
  };

  #statement(statement: DbStatement, scope: string | null): void {
    const handler: StatementHandler | undefined = Object.hasOwn(
      this.#handlers,
      statement.stmt ?? '',
    )
      ? this.#handlers[statement.stmt ?? '']
      : undefined;
    handler?.(statement, scope);
  }

  #style(statement: DbStatement): void {
    this.#result.styles.push({
      ids: (statement.id ?? '').split(',').map((id: string) => id.trim()),
      css: decodeDb(statement.styleClass).trim(),
    });
  }

  #get(id: string): StateNode {
    const known: StateNode | undefined = this.#byId.get(id);
    if (known) {
      return known;
    }
    const state: StateNode = {
      id,
      type: 'state',
      isComposite: false,
      regions: 0,
      name: '',
      desc: [],
      parent: null,
      classes: [],
      dir: '',
    };
    this.#byId.set(id, state);
    this.#result.states.push(state);
    return state;
  }

  #direction(statement: DbStatement, scope: string | null): void {
    if (scope === null) {
      this.#result.direction = directionOf(statement.value);
      return;
    }
    const owner: StateNode | undefined = this.#byId.get(scope);
    if (!regionOf(this.#result, scope) && owner) {
      owner.dir = statement.value ?? '';
    }
  }

  #relation(statement: DbStatement, scope: string | null): void {
    const from: string | null = this.#occur(statement.state1, scope);
    const to: string | null = this.#occur(statement.state2, scope);
    if (from !== null && to !== null) {
      const id: string = `t${String(this.#result.transitions.length)}`;
      this.#result.transitions.push({
        id,
        from,
        to,
        label: decodeDb(statement.description).trim(),
      });
    }
  }

  // One occurrence of a state in a scope; returns its id (a pseudo id for `[*]`).
  #occur(statement: DbStatement | undefined, scope: string | null): string | null {
    if (!statement) {
      return null;
    }
    if (statement.start === true || statement.start === false) {
      return statement.start ? startId(scope) : endId(scope);
    }
    const id: string = String(statement.id).trim();
    const state: StateNode = this.#get(id);
    const type: StateType | undefined = TYPES.find((known: StateType) => known === statement.type);
    state.type = type && type !== 'state' ? type : state.type;
    this.#describe(id, statement.description);
    this.#addClasses(state, statement.classes ?? []);
    state.parent = scope ?? state.parent;
    return id;
  }

  #describe(id: string, description: string | string[] | undefined): void {
    if (description) {
      this.#descriptions.set(id, [
        ...(this.#descriptions.get(id) ?? []),
        decodeDb(description).trim(),
      ]);
    }
  }

  #addClasses(state: StateNode, classes: readonly string[]): void {
    for (const name of classes) {
      if (name && !state.classes.includes(name)) {
        state.classes.push(name);
      }
    }
  }

  #state(statement: DbStatement, scope: string | null): void {
    const id: string | null = isDivider(statement) ? null : this.#occur(statement, scope);
    if (id === null) {
      return;
    }
    if (statement.note) {
      this.#note(id, statement.note);
    }
    if (Array.isArray(statement.doc)) {
      this.#composite(id, statement.doc);
    }
  }

  #note(target: string, note: { text: string; position?: string }): void {
    const text: string = decodeDb(note.text)
      .split('\n')
      .map((line: string) => line.trim())
      .join('\n')
      .trim();
    this.#result.notes.push({
      id: '',
      target,
      side: note.position === 'left of' ? 'left' : 'right',
      text,
    });
  }

  #composite(id: string, doc: readonly DbStatement[]): void {
    const state: StateNode = this.#get(id);
    state.isComposite = true;
    const regions: DbStatement[][] | null = splitRegions(doc);
    if (regions === null) {
      this.walk(doc, id);
      return;
    }
    state.regions = regions.length;
    regions.forEach((region: DbStatement[], index: number) =>
      this.walk(region, regionScope(id, index)),
    );
  }

  #applyClass(statement: DbStatement): void {
    for (const id of (statement.id ?? '').split(',')) {
      this.#addClasses(this.#get(id.trim()), [(statement.styleClass ?? '').trim()]);
    }
  }

  #named(state: StateNode): StateNode {
    const descriptions: string[] = this.#descriptions.get(state.id) ?? [];
    if (state.type !== 'state') {
      return { ...state, name: '', desc: [] };
    }
    if (state.isComposite) {
      const first: string = descriptions[0] ?? '';
      return { ...state, name: first === state.id ? '' : first, desc: [] };
    }
    return { ...state, ...this.#leafText(state.id, descriptions) };
  }

  // A leaf: `Id : text` lines are its description; `state "Name" as Id` is its display name.
  #leafText(id: string, descriptions: readonly string[]): Pick<StateNode, 'name' | 'desc'> {
    const alias: string | undefined = this.#aliases.get(id);
    const desc: string[] = (
      alias === undefined ? [...descriptions] : withoutOne(descriptions, alias)
    ).filter(Boolean);
    const name: string = alias === undefined || (alias === id && desc.length === 0) ? '' : alias;
    return { name, desc };
  }
}
