// Pure state-model edits. Each returns a new model (some return { model, id }).
import { assignNoteIds, transitionScope } from './model.ts';
import {
  endId,
  nodeScope,
  pseudoOf,
  regionOf,
  regionScope,
  scopeChain,
  scopeExists,
  scopeInsideState,
  scopeWithin,
  startId,
  stateById,
  uniqueId,
} from './scopes.ts';
import { textAt } from '../shared/values.ts';

import type {
  NoteSide,
  Pseudo,
  StateModel,
  StateNode,
  StateNote,
  StateStyle,
  StateTransition,
} from './types.ts';

const INDEX_GROUP: number = 2;
type Rename = (id: string) => string;

function mapStates(model: StateModel, edit: (state: StateNode) => StateNode): StateModel {
  return { ...model, states: model.states.map(edit) };
}

/** Points every transition end and loose pseudo state through `ref`. */
function mapRefs(model: StateModel, ref: Rename): StateModel {
  return {
    ...model,
    transitions: model.transitions.map((transition: StateTransition) => ({
      ...transition,
      from: ref(transition.from),
      to: ref(transition.to),
    })),
    pseudo: model.pseudo.map(ref),
  };
}

/** A pseudo id moved to the scope `move` gives its old scope; state ids are unchanged. */
function movedPseudo(id: string, move: (scope: string | null) => string | null): string {
  const pseudo: Pseudo | null = pseudoOf(id);
  if (!pseudo) {
    return id;
  }
  const scope: string | null = move(pseudo.scope);
  return pseudo.kind === 'start' ? startId(scope) : endId(scope);
}

/** Adds a state to a scope; every field but `id` defaults to an empty plain state. */
export function addState(
  model: StateModel,
  state: Pick<StateNode, 'id'> & Partial<StateNode>,
  parent: string | null = null,
): StateModel {
  const added: StateNode = {
    type: 'state',
    isComposite: false,
    regions: 0,
    name: '',
    desc: [],
    classes: [],
    dir: '',
    ...state,
    parent,
  };
  return { ...model, states: [...model.states, added] };
}

export function updateState(model: StateModel, id: string, patch: Partial<StateNode>): StateModel {
  return mapStates(model, (state: StateNode) => (state.id === id ? { ...state, ...patch } : state));
}

function renameScope(from: string, to: string): (scope: string | null) => string | null {
  return (scope: string | null): string | null => {
    if (scope === from) {
      return to;
    }
    const region: RegExpExecArray | null = /^(.*)#(\d+)$/.exec(scope ?? '');
    return region?.[1] === from ? regionScope(to, textAt(region, INDEX_GROUP)) : scope;
  };
}

function renameStates(model: StateModel, from: string, to: string): StateModel {
  const scope: (value: string | null) => string | null = renameScope(from, to);
  return {
    ...model,
    states: model.states.map((state: StateNode) => ({
      ...state,
      id: state.id === from ? to : state.id,
      parent: scope(state.parent),
    })),
    notes: model.notes.map((note: StateNote) =>
      note.target === from ? { ...note, target: to } : note,
    ),
    styles: model.styles.map((style: StateStyle) => ({
      ...style,
      ids: style.ids.map((id: string) => (id === from ? to : id)),
    })),
  };
}

/** Changes a state's id everywhere it is referenced. Unchanged when the new id is taken. */
export function renameState(model: StateModel, from: string, to: string): StateModel {
  if (from === to || stateById(model, to)) {
    return model;
  }
  const scope: (value: string | null) => string | null = renameScope(from, to);
  const ref: Rename = (id: string): string => (id === from ? to : movedPseudo(id, scope));
  return assignNoteIds(renameStates(mapRefs(model, ref), from, to));
}

function isOutside(model: StateModel, pseudo: Pseudo | null, other: string): boolean {
  const scope: string | null = pseudo?.scope ?? null;
  return scope !== null && !scopeWithin(model, nodeScope(model, other), scope);
}

// Initial/final transitions must stay inside their pseudo state's scope. When a state leaves that
// scope, its [*] transitions follow it to its new scope.
function fixPseudoTransitions(model: StateModel): StateModel {
  const fix = (transition: StateTransition): StateTransition => {
    const from: Pseudo | null = pseudoOf(transition.from);
    const to: Pseudo | null = pseudoOf(transition.to);
    if (!to && isOutside(model, from, transition.to)) {
      return { ...transition, from: startId(nodeScope(model, transition.to)) };
    }
    if (!from && isOutside(model, to, transition.from)) {
      return { ...transition, to: endId(nodeScope(model, transition.from)) };
    }
    return transition;
  };
  return { ...model, transitions: model.transitions.map(fix) };
}

/** Moves a state to another scope. Unchanged when it is already there or would end up inside itself. */
export function setParent(model: StateModel, id: string, scope: string | null): StateModel {
  const state: StateNode | undefined = stateById(model, id);
  if (!state || state.parent === scope || (scope !== null && scopeInsideState(model, scope, id))) {
    return model;
  }
  return normalize(fixPseudoTransitions(updateState(model, id, { parent: scope })));
}

function ownerOf(model: StateModel, scope: string): string {
  return regionOf(model, scope)?.id ?? scope;
}

/** Ids of a composite and everything nested in it. */
export function subtree(model: StateModel, id: string): Set<string> {
  const ids: Set<string> = new Set<string>([id]);
  let size: number = 0;
  while (size !== ids.size) {
    size = ids.size;
    for (const state of model.states) {
      if (state.parent !== null && ids.has(ownerOf(model, state.parent))) {
        ids.add(state.id);
      }
    }
  }
  return ids;
}

export interface StateSelection {
  stateIds?: readonly string[];
  transitionIds?: readonly string[];
  noteIds?: readonly string[];
  pseudoIds?: readonly string[];
}

function isPseudoInRemoved(model: StateModel, id: string, removed: ReadonlySet<string>): boolean {
  const scope: string | null | undefined = pseudoOf(id)?.scope;
  return scope !== null && scope !== undefined && removed.has(ownerOf(model, scope));
}

function removedStates(model: StateModel, stateIds: readonly string[]): Set<string> {
  return new Set<string>(stateIds.flatMap((id: string) => [...subtree(model, id)]));
}

/** Deletes states (with everything inside them), transitions, notes and loose pseudo states. */
export function deleteItems(
  model: StateModel,
  { stateIds = [], transitionIds = [], noteIds = [], pseudoIds = [] }: StateSelection,
): StateModel {
  const removed: Set<string> = removedStates(model, stateIds);
  const isGone = (id: string): boolean =>
    removed.has(id) || pseudoIds.includes(id) || isPseudoInRemoved(model, id, removed);
  const isKept = (transition: StateTransition): boolean =>
    !transitionIds.includes(transition.id) && !isGone(transition.from) && !isGone(transition.to);
  return normalize({
    ...model,
    states: model.states.filter((state: StateNode) => !removed.has(state.id)),
    transitions: model.transitions.filter(isKept),
    notes: model.notes.filter(
      (note: StateNote) => !noteIds.includes(note.id) && !removed.has(note.target),
    ),
    pseudo: model.pseudo.filter((id: string) => !isGone(id)),
  });
}

export interface NewTransition {
  from: string;
  to: string;
  label?: string;
}

/** Adds a transition with the next free id; its ends stop being loose pseudo states. */
export function addTransition(
  model: StateModel,
  { from, to, label = '' }: NewTransition,
): StateModel {
  let index: number = model.transitions.length;
  while (
    model.transitions.some((transition: StateTransition) => transition.id === `t${String(index)}`)
  ) {
    index++;
  }
  return {
    ...model,
    transitions: [...model.transitions, { id: `t${String(index)}`, from, to, label }],
    pseudo: model.pseudo.filter((id: string) => id !== from && id !== to),
  };
}

export function updateTransition(
  model: StateModel,
  id: string,
  patch: Partial<StateTransition>,
): StateModel {
  return {
    ...model,
    transitions: model.transitions.map((transition: StateTransition) =>
      transition.id === id ? { ...transition, ...patch } : transition,
    ),
  };
}

// [*] as a source is a start and as a target an end, so reversing swaps them.
function flip(id: string): string {
  const pseudo: Pseudo | null = pseudoOf(id);
  if (!pseudo) {
    return id;
  }
  return pseudo.kind === 'start' ? endId(pseudo.scope) : startId(pseudo.scope);
}

/** Reverses a transition. Throws when there is no such transition. */
export function reverseTransition(model: StateModel, id: string): StateModel {
  const transition: StateTransition | undefined = model.transitions.find(
    (candidate: StateTransition) => candidate.id === id,
  );
  if (!transition) {
    throw new Error(`No transition "${id}"`);
  }
  return updateTransition(model, id, { from: flip(transition.to), to: flip(transition.from) });
}

/** Adds a loose pseudo state (one with no transition yet). */
export function addPseudo(model: StateModel, id: string): StateModel {
  const isUsed: boolean =
    model.pseudo.includes(id) ||
    model.transitions.some(
      (transition: StateTransition) => transition.from === id || transition.to === id,
    );
  return isUsed ? model : { ...model, pseudo: [...model.pseudo, id] };
}

// The lowest scope that contains all the given scopes.
function commonScope(model: StateModel, scopes: readonly (string | null)[]): string | null {
  const chainOf = (scope: string | null): (string | null)[] => [...scopeChain(model, scope), null];
  const [first = null, ...rest] = scopes;
  const common: (string | null)[] = rest.reduce(
    (shared: (string | null)[], scope: string | null) => {
      const chain: (string | null)[] = chainOf(scope);
      return shared.filter((candidate: string | null) => chain.includes(candidate));
    },
    chainOf(first),
  );
  return common[0] ?? null;
}

// The selected states that are not nested inside another selected composite (those move with it).
function topSelected(model: StateModel, ids: readonly string[]): string[] {
  const selected: string[] = ids.filter((id: string) => stateById(model, id));
  return selected.filter(
    (id: string) =>
      !selected.some((other: string) => other !== id && subtree(model, other).has(id)),
  );
}

/** Wraps states in a new composite, nested in their common scope. */
export function wrapInComposite(
  model: StateModel,
  ids: readonly string[],
): { model: StateModel; id: string | null } {
  const tops: string[] = topSelected(model, ids);
  if (tops.length === 0) {
    return { model, id: null };
  }
  const parents: (string | null)[] = tops.map((id: string) => stateById(model, id)?.parent ?? null);
  const id: string = uniqueId(model, 'Composite');
  const added: StateModel = addState(model, { id, isComposite: true }, commonScope(model, parents));
  const moved: StateModel = mapStates(added, (state: StateNode) =>
    tops.includes(state.id) ? { ...state, parent: id } : state,
  );
  return { model: normalize(fixPseudoTransitions(moved)), id };
}

function withoutComposite(model: StateModel, composite: StateNode): StateModel {
  const { id } = composite;
  const isOwn = (scope: string | null): boolean =>
    scope !== null && (scope === id || regionOf(model, scope)?.id === id);
  const isGone = (end: string): boolean => end === id || isOwn(pseudoOf(end)?.scope ?? null);
  return {
    ...model,
    states: model.states
      .filter((state: StateNode) => state.id !== id)
      .map((state: StateNode) =>
        isOwn(state.parent) ? { ...state, parent: composite.parent } : state,
      ),
    transitions: model.transitions.filter(
      (transition: StateTransition) => !isGone(transition.from) && !isGone(transition.to),
    ),
    notes: model.notes.filter((note: StateNote) => note.target !== id),
    pseudo: model.pseudo.filter((pseudo: string) => !isGone(pseudo)),
  };
}

/** Removes a composite; its children move up to its scope. Its own transitions go with it. */
export function ungroup(model: StateModel, id: string): StateModel {
  const composite: StateNode | undefined = stateById(model, id);
  return composite ? normalize(fixPseudoTransitions(withoutComposite(model, composite))) : model;
}

// A plain composite becomes region 1: its children and pseudo states move to `X#0`.
function splitIntoFirstRegion(model: StateModel, id: string): StateModel {
  const first: string = regionScope(id, 0);
  const moved: StateModel = mapRefs(model, (end: string) =>
    movedPseudo(end, (scope: string | null) => (scope === id ? first : scope)),
  );
  return mapStates(moved, (state: StateNode) => {
    if (state.id === id) {
      return { ...state, regions: 1 };
    }
    return state.parent === id ? { ...state, parent: first } : state;
  });
}

/** Adds a concurrent region holding a new state. A plain composite becomes region 1 + region 2. */
export function addRegion(model: StateModel, id: string, stateId: string): StateModel {
  const composite: StateNode | undefined = stateById(model, id);
  if (!composite?.isComposite) {
    return model;
  }
  const split: StateModel = composite.regions ? model : splitIntoFirstRegion(model, id);
  const count: number = stateById(split, id)?.regions ?? 0;
  return addState(
    updateState(split, id, { regions: count + 1 }),
    { id: stateId },
    regionScope(id, count),
  );
}

export interface NewNote {
  target: string;
  side?: NoteSide;
  text?: string;
}

export function addNote(
  model: StateModel,
  { target, side = 'right', text = 'Note' }: NewNote,
): StateModel {
  return assignNoteIds({ ...model, notes: [...model.notes, { id: '', target, side, text }] });
}

export function updateNote(model: StateModel, id: string, patch: Partial<StateNote>): StateModel {
  return {
    ...model,
    notes: model.notes.map((note: StateNote) => (note.id === id ? { ...note, ...patch } : note)),
  };
}

// ---- normalize ----

function isRegionBusy(model: StateModel, scope: string): boolean {
  return (
    model.states.some((state: StateNode) => state.parent === scope) ||
    model.transitions.some(
      (transition: StateTransition) => transitionScope(model, transition) === scope,
    ) ||
    model.pseudo.some((id: string) => pseudoOf(id)?.scope === scope)
  );
}

// Region scopes renamed after empty regions are dropped; one region left means no regions.
function regionMoves(composite: StateNode, used: readonly number[]): Map<string, string> {
  const moves: Map<string, string> = new Map<string, string>();
  used.forEach((old: number, index: number) => {
    moves.set(
      regionScope(composite.id, old),
      used.length > 1 ? regionScope(composite.id, index) : composite.id,
    );
  });
  return moves;
}

function compactRegions(model: StateModel, composite: StateNode): StateModel {
  const used: number[] = [...Array.from({ length: composite.regions }).keys()].filter(
    (index: number) => isRegionBusy(model, regionScope(composite.id, index)),
  );
  if (used.length === composite.regions && used.length > 1) {
    return model;
  }
  const moves: Map<string, string> = regionMoves(composite, used);
  const move = (scope: string | null): string | null =>
    scope !== null && moves.has(scope) ? (moves.get(scope) ?? scope) : scope;
  const regions: number = used.length > 1 ? used.length : 0;
  return mapStates(
    mapRefs(model, (id: string) => movedPseudo(id, move)),
    (state: StateNode) =>
      state.id === composite.id ? { ...state, regions } : { ...state, parent: move(state.parent) },
  );
}

function liveStyles(styles: readonly StateStyle[], ids: ReadonlySet<string>): StateStyle[] {
  return styles
    .map((style: StateStyle) => ({ ...style, ids: style.ids.filter((id: string) => ids.has(id)) }))
    .filter((style: StateStyle) => style.ids.length > 0);
}

function aliveCheck(model: StateModel, ids: ReadonlySet<string>): (id: string) => boolean {
  return (id: string): boolean => {
    const pseudo: Pseudo | null = pseudoOf(id);
    return pseudo ? scopeExists(model, pseudo.scope) : ids.has(id);
  };
}

function rootOrphans(model: StateModel): StateNode[] {
  return model.states.map((state: StateNode) =>
    state.parent !== null && !scopeExists(model, state.parent) ? { ...state, parent: null } : state,
  );
}

function dropDangling(model: StateModel): StateModel {
  const ids: Set<string> = new Set<string>(model.states.map((state: StateNode) => state.id));
  const isAlive: (id: string) => boolean = aliveCheck(model, ids);
  const isLinked = (id: string): boolean =>
    model.transitions.some(
      (transition: StateTransition) => transition.from === id || transition.to === id,
    );
  return {
    ...model,
    states: rootOrphans(model),
    transitions: model.transitions.filter(
      (transition: StateTransition) => isAlive(transition.from) && isAlive(transition.to),
    ),
    notes: model.notes.filter((note: StateNote) => ids.has(note.target)),
    pseudo: model.pseudo.filter((id: string) => isAlive(id) && !isLinked(id)),
    styles: liveStyles(model.styles, ids),
  };
}

/** Keeps the model consistent after structural edits: compacts regions, drops dangling references, renumbers notes. */
export function normalize(model: StateModel): StateModel {
  const composites: StateNode[] = model.states.filter(
    (state: StateNode) => state.isComposite && state.regions > 0,
  );
  return assignNoteIds(dropDangling(composites.reduce(compactRegions, model)));
}

// ---- checks ----

function isEndAllowed(model: StateModel, pseudo: Pseudo | null, other: string): boolean {
  const scope: string | null = pseudo?.scope ?? null;
  return scope === null || scopeWithin(model, nodeScope(model, other), scope);
}

function canLink(model: StateModel, from: string, to: string): boolean {
  const source: Pseudo | null = pseudoOf(from);
  const target: Pseudo | null = pseudoOf(to);
  if (source?.kind === 'end' || target?.kind === 'start') {
    return false;
  }
  if (source && target) {
    return source.scope === target.scope;
  }
  return isEndAllowed(model, source, to) && isEndAllowed(model, target, from);
}

/** Can a transition run between these ends? Returns them (swapped if only that works), or null. */
export function checkTransition(
  model: StateModel,
  from: string,
  to: string,
): { from: string; to: string } | null {
  if (canLink(model, from, to)) {
    return { from, to };
  }
  return canLink(model, to, from) ? { from: to, to: from } : null;
}
