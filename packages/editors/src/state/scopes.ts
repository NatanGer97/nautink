// Scopes, pseudo states and regions of the state model.
import { textAt } from '../shared/values.ts';

import type { Pseudo, Region, StateModel, StateNode } from './types.ts';

const SCOPE_GROUP: number = 2;
const MAX_DEPTH: number = 100;
const RESERVED: RegExp =
  /^(state|note|end|as|direction|classDef|class|style|click|left|right|of|accTitle|accDescr|stateDiagram|stateDiagram-v2)$/i;

type States = Pick<StateModel, 'states'>;

export function startId(scope: string | null): string {
  return `start:${scope ?? ''}`;
}

export function endId(scope: string | null): string {
  return `end:${scope ?? ''}`;
}

/** The pseudo state an id names, or null for a state id. */
export function pseudoOf(id: string): Pseudo | null {
  const match: RegExpExecArray | null = /^(start|end):(.*)$/.exec(id);
  if (match === null) {
    return null;
  }
  const scope: string = textAt(match, SCOPE_GROUP);
  return { kind: match[1] === 'start' ? 'start' : 'end', scope: scope === '' ? null : scope };
}

/** The region scopes of a composite with `count` regions. */
export function regionScopes(id: string, count: number): string[] {
  return [...Array.from({ length: count }).keys()].map((index: number) => regionScope(id, index));
}

export function regionScope(id: string, index: number | string): string {
  return `${id}#${String(index)}`;
}

export function stateById(model: States, id: string): StateNode | undefined {
  return model.states.find((state: StateNode) => state.id === id);
}

/** The region a scope names, or null when it is not a region of a composite with regions. */
export function regionOf(model: States, scope: string | null): Region | null {
  const match: RegExpExecArray | null = /^(.*)#(\d+)$/.exec(scope ?? '');
  const owner: StateNode | undefined = match ? stateById(model, textAt(match, 1)) : undefined;
  if (!match || !owner || owner.regions <= 0) {
    return null;
  }
  return { id: owner.id, index: Number(match[2]) };
}

/** The scope that contains a scope: null for a top-level one, undefined above the top. */
export function scopeParent(model: States, scope: string | null): string | null | undefined {
  if (scope === null) {
    return undefined;
  }
  const region: Region | null = regionOf(model, scope);
  if (region) {
    return region.id;
  }
  return stateById(model, scope)?.parent ?? null;
}

/** Every scope that can hold states: null, plain composites and regions. */
export function allScopes(model: States): (string | null)[] {
  return [
    null,
    ...model.states
      .filter((state: StateNode) => state.isComposite)
      .flatMap((state: StateNode) =>
        state.regions > 0 ? regionScopes(state.id, state.regions) : [state.id],
      ),
  ];
}

export function scopeExists(model: States, scope: string | null): boolean {
  if (scope === null) {
    return true;
  }
  const region: Region | null = regionOf(model, scope);
  if (region) {
    return region.index < (stateById(model, region.id)?.regions ?? 0);
  }
  const state: StateNode | undefined = stateById(model, scope);
  return Boolean(state?.isComposite && !state.regions);
}

/** The scope a node sits in: a pseudo state's own scope, or a state's parent. */
export function nodeScope(model: States, id: string): string | null {
  const pseudo: Pseudo | null = pseudoOf(id);
  if (pseudo) {
    return pseudo.scope;
  }
  return stateById(model, id)?.parent ?? null;
}

/** The chain of scopes from `scope` up to (not including) the top level. */
export function scopeChain(model: States, scope: string | null): string[] {
  const chain: string[] = [];
  let current: string | null | undefined = scope;
  while (current !== null && current !== undefined && chain.length < MAX_DEPTH) {
    chain.push(current);
    current = scopeParent(model, current);
  }
  return chain;
}

/** Is `scope` equal to or nested inside `ancestor`? */
export function scopeWithin(model: States, scope: string | null, ancestor: string | null): boolean {
  return ancestor === null || scopeChain(model, scope).includes(ancestor);
}

/** Is the scope part of state `id` (its own scope or regions, or anything inside them)? */
export function scopeInsideState(model: States, scope: string | null, id: string): boolean {
  return scopeChain(model, scope).some(
    (current: string) => current === id || regionOf(model, current)?.id === id,
  );
}

export function displayName(state: StateNode): string {
  return state.name || state.id;
}

/** A human name for a scope: "Top level", a composite's name, or "Name › region 2". */
export function scopeLabel(model: States, scope: string | null): string {
  if (scope === null) {
    return 'Top level';
  }
  const region: Region | null = regionOf(model, scope);
  const owner: StateNode | undefined = stateById(model, region ? region.id : scope);
  if (!owner) {
    return scope;
  }
  return region ? `${displayName(owner)} › region ${String(region.index + 1)}` : displayName(owner);
}

/** Can `text` be a state id without quoting? */
export function isValidId(text: string): boolean {
  return /^[\p{L}_][\p{L}\p{N}_]*$/u.test(text) && !RESERVED.test(text);
}

/** The first free state id `<prefix><n>`. */
export function uniqueId(model: States, prefix: string = 'State'): string {
  const taken: Set<string> = new Set<string>(model.states.map((state: StateNode) => state.id));
  let index: number = 1;
  while (taken.has(`${prefix}${String(index)}`)) {
    index++;
  }
  return `${prefix}${String(index)}`;
}
