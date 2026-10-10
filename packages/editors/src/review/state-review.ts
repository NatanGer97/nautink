// A state diagram as review elements: states (composites too), transitions and notes.
import { removedRefs, signature } from './review-element.ts';
import { stateEditor } from '../state/model.ts';

import type { ReviewAdapter } from './review-adapter.ts';
import type { ReviewElement } from './review-element.ts';
import type { StateModel, StateNode, StateNote, StateTransition } from '../state/types.ts';

function stateElement(state: StateNode): ReviewElement {
  const { id, ...fields } = state;
  return { id, kind: 'node', key: `state:${id}`, sig: signature(fields), label: state.name || id };
}

function transitionElement(transition: StateTransition): ReviewElement {
  const { id, from, to, label } = transition;
  return {
    id,
    kind: 'edge',
    key: `transition:${from}>${to}`,
    sig: label,
    label: label || `${from} → ${to}`,
    ends: [from, to],
  };
}

function noteElement(note: StateNote): ReviewElement {
  const { id, target, side, text } = note;
  return { id, kind: 'note', key: `note:${target}`, sig: signature({ side, text }), label: text };
}

/** States, transitions, then notes. */
export function stateElements(model: StateModel): ReviewElement[] {
  return [
    ...model.states.map(stateElement),
    ...model.transitions.map(transitionElement),
    ...model.notes.map(noteElement),
  ];
}

/** Every scope a state can sit in: composites, and the regions of concurrent composites. */
function scopesOf(states: readonly StateNode[]): Set<string> {
  return new Set<string>(
    states
      .filter((state: StateNode) => state.isComposite)
      .flatMap((state: StateNode) =>
        state.regions > 0
          ? Array.from(
              { length: state.regions },
              (...[, index]: [unknown, number]) => `${state.id}#${String(index)}`,
            )
          : [state.id],
      ),
  );
}

/** The proposal plus what it removed. A ghost whose scope is gone shows at the top level. */
export function stateUnion(before: StateModel, after: StateModel): StateModel {
  const removed: Set<string> = removedRefs(stateElements(before), stateElements(after));
  const ghosts: StateNode[] = before.states.filter((state) => removed.has(`node:${state.id}`));
  const scopes: Set<string> = scopesOf([...after.states, ...ghosts]);
  return {
    ...after,
    states: [
      ...after.states,
      ...ghosts.map((state: StateNode) =>
        state.parent === null || scopes.has(state.parent) ? state : { ...state, parent: null },
      ),
    ],
    transitions: [
      ...after.transitions,
      ...before.transitions.filter((transition) => removed.has(`edge:${transition.id}`)),
    ],
    notes: [...after.notes, ...before.notes.filter((note) => removed.has(`note:${note.id}`))],
  };
}

export const stateReview: ReviewAdapter<StateModel> = {
  module: stateEditor,
  elements: stateElements,
  union: stateUnion,
};
