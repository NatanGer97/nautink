import { allScopes, scopeInsideState, scopeLabel } from '@nautink/editors/state/scopes';
import { useState } from 'react';

import { renameId } from './state-actions.ts';
import { setParent } from './state-move.ts';
import { CommitField, SelectField } from '../canvas/inspector-fields.tsx';

import type { StateActionContext } from './state-actions.ts';
import type { StateSelection } from './state-types.ts';
import type { Choice, SelectOption, SelectOptionGroup } from '../canvas/inspector-fields.tsx';
import type { NoteSide, StateModel, StateNode, StateType } from '@nautink/editors/state/types';
import type { ReactElement, ReactNode } from 'react';

export const KIND_CHOICES: readonly Choice<StateType>[] = [
  { value: 'state', label: 'State' },
  { value: 'choice', label: 'Choice' },
  { value: 'fork', label: 'Fork' },
  { value: 'join', label: 'Join' },
];

export const SIDE_CHOICES: readonly Choice<NoteSide>[] = [
  { value: 'left', label: 'Left of' },
  { value: 'right', label: 'Right of' },
];

/** A composite's own direction: Mermaid writes `direction` inside the block, or it inherits. */
export const INSIDE_DIRECTION_OPTIONS: SelectOptionGroup[] = [
  {
    label: 'Direction',
    options: [
      { value: '', label: 'Inherit' },
      { value: 'TB', label: 'Top → down' },
      { value: 'LR', label: 'Left → right' },
      { value: 'BT', label: 'Bottom → up' },
      { value: 'RL', label: 'Right → left' },
    ],
  },
];

export interface StatePartProps {
  model: StateModel;
  state: StateNode;
  context: StateActionContext;
}

/** The state's id: renaming it renames every reference; a bad or taken id says so (v1's `IdField`). */
export function IdField({
  state,
  context,
  selection,
}: Omit<StatePartProps, 'model'> & { selection: StateSelection }): ReactElement {
  const [isRejected, setRejected] = useState<boolean>(false);
  return (
    <div className="flex flex-col gap-1">
      <CommitField
        label="Id"
        value={state.id}
        onCommit={(text) => {
          setRejected(!renameId(context, { from: state.id, to: text.trim() }, selection));
        }}
      />
      {isRejected ? (
        <p role="alert" className="text-xs text-destructive">
          Use letters, digits and _ only, and an id no other state has.
        </p>
      ) : null}
    </div>
  );
}

/** Which composite (or region) the state sits in; hidden when there is nowhere else to go. */
export function Membership({ model, state, context }: StatePartProps): ReactElement | null {
  const scopes: (string | null)[] = allScopes(model).filter(
    (scope: string | null) => scope === null || !scopeInsideState(model, scope, state.id),
  );
  if (scopes.length <= 1) {
    return null;
  }
  const options: SelectOption[] = scopes.map((scope: string | null) => ({
    value: scope ?? '',
    label: scopeLabel(model, scope),
  }));
  return (
    <SelectField
      label="Inside composite"
      value={state.parent ?? ''}
      groups={[{ label: 'Composites', options }]}
      onChange={(scope) => {
        setParent(context, state.id, scope === '' ? null : scope);
      }}
    />
  );
}

/** A quiet line of explanation inside the inspector. */
export function InspectorNote({ children }: { children: ReactNode }): ReactElement {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
