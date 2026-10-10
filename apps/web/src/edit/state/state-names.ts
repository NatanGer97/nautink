import { displayName, pseudoOf, stateById } from '@nautink/editors/state/scopes';
import { clip } from '@nautink/visual-core/text';

import type { Pseudo, StateModel, StateNode, StateTransition } from '@nautink/editors/state/types';

const NAME_CLIP: number = 28;

/** A state's name in step labels: its display name, or `start`, `end` for a pseudo state (v1's `stName`). */
export function stateName(model: StateModel, id: string): string {
  const pseudo: Pseudo | null = pseudoOf(id);
  if (pseudo) {
    return pseudo.kind;
  }
  const state: StateNode | undefined = stateById(model, id);
  return clip(state ? displayName(state) : id, NAME_CLIP);
}

/** "Idle → Busy" for a transition, or '' when there is no such transition (v1's `trName`). */
export function transitionName(model: StateModel, id: string): string {
  const transition: StateTransition | undefined = model.transitions.find(
    (item: StateTransition) => item.id === id,
  );
  return transition === undefined
    ? ''
    : `${stateName(model, transition.from)} → ${stateName(model, transition.to)}`;
}

/** A transition end as the inspector shows it: `[*]` for a pseudo state, else the state's name. */
export function endName(model: StateModel, id: string): string {
  return pseudoOf(id) ? '[*]' : stateName(model, id);
}
