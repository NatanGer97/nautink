import { pseudoOf, scopeLabel, stateById } from '@nautink/editors/state/scopes';

import {
  deleteSelection,
  reverseTransition,
  ungroup,
  updateNote,
  updateState,
  updateTransition,
  wrap,
} from './state-actions.ts';
import { addNoteOn, addRegion, addStateInside } from './state-add.ts';
import {
  IdField,
  INSIDE_DIRECTION_OPTIONS,
  InspectorNote,
  KIND_CHOICES,
  Membership,
  SIDE_CHOICES,
} from './state-inspector-parts.tsx';
import { endName, stateName } from './state-names.ts';
import { NO_SELECTION } from './state-types.ts';
import { InspectorActions, InspectorButton, InspectorCard } from '../canvas/inspector-card.tsx';
import { ChoiceField, CommitField, SelectField } from '../canvas/inspector-fields.tsx';

import type { StateActionContext } from './state-actions.ts';
import type { StateSelection } from './state-types.ts';
import type {
  Pseudo,
  StateModel,
  StateNode,
  StateNote,
  StateTransition,
  StateType,
} from '@nautink/editors/state/types';
import type { ReactElement } from 'react';

export interface StateInspectorProps {
  model: StateModel;
  selection: StateSelection;
  context: StateActionContext;
  isReadOnly: boolean;
  /** A double-clicked transition opens with its label field focused. */
  shouldFocusEdgeLabel: boolean;
}

interface Shared {
  model: StateModel;
  context: StateActionContext;
  isReadOnly: boolean;
  selection: StateSelection;
}

function DeleteButton({ context, selection }: Pick<Shared, 'context' | 'selection'>): ReactElement {
  return (
    <InspectorButton
      isDestructive
      onClick={() => {
        deleteSelection(context, selection);
      }}
    >
      Delete
    </InspectorButton>
  );
}

function ManyInspector({ model, context, isReadOnly, selection }: Shared): ReactElement {
  const states: string[] = selection.nodes.filter((id) => stateById(model, id));
  const names: string = selection.nodes.map((id) => stateName(model, id)).join(', ');
  return (
    <InspectorCard
      title={`${String(selection.nodes.length)} selected`}
      subtitle={names}
      isReadOnly={isReadOnly}
    >
      <InspectorActions>
        {states.length > 0 ? (
          <InspectorButton
            onClick={() => {
              wrap(context, states);
            }}
          >
            Wrap in composite
          </InspectorButton>
        ) : null}
        <DeleteButton context={context} selection={selection} />
      </InspectorActions>
    </InspectorCard>
  );
}

function PseudoInspector({
  model,
  context,
  isReadOnly,
  selection,
  pseudo,
}: Shared & { pseudo: Pseudo }): ReactElement {
  return (
    <InspectorCard
      title={pseudo.kind === 'start' ? 'Start' : 'End'}
      subtitle="[*]"
      isReadOnly={isReadOnly}
    >
      <InspectorNote>
        In {scopeLabel(model, pseudo.scope)}. Drag from its edge to connect.
      </InspectorNote>
      <InspectorActions>
        <DeleteButton context={context} selection={selection} />
      </InspectorActions>
    </InspectorCard>
  );
}

function NoteInspector({
  context,
  isReadOnly,
  selection,
  note,
}: Shared & { note: StateNote }): ReactElement {
  return (
    <InspectorCard title="Note" subtitle={`on ${note.target}`} isReadOnly={isReadOnly}>
      <CommitField
        label="Text"
        isMultiline
        value={note.text}
        onCommit={(text) => {
          updateNote(context, note.id, { text });
        }}
      />
      <ChoiceField
        label="Side"
        value={note.side}
        choices={SIDE_CHOICES}
        onChange={(side) => {
          updateNote(context, note.id, { side });
        }}
      />
      <InspectorActions>
        <DeleteButton context={context} selection={selection} />
      </InspectorActions>
    </InspectorCard>
  );
}

function NameField({
  state,
  context,
}: {
  state: StateNode;
  context: StateActionContext;
}): ReactElement {
  return (
    <CommitField
      label="Display name"
      value={state.name}
      placeholder={state.id}
      onCommit={(text) => {
        updateState(context, state.id, { name: text.trim() });
      }}
    />
  );
}

function CompositeActions({
  context,
  selection,
  state,
}: Pick<Shared, 'context' | 'selection'> & { state: StateNode }): ReactElement {
  const inside: string = state.regions > 0 ? `${state.id}#0` : state.id;
  const actions: readonly [string, () => void][] = [
    [
      'Add state inside',
      (): void => {
        addStateInside(context, inside);
      },
    ],
    [
      'Add concurrent region',
      (): void => {
        addRegion(context, state.id);
      },
    ],
    [
      'Add note',
      (): void => {
        addNoteOn(context, state.id);
      },
    ],
    [
      'Wrap in composite',
      (): void => {
        wrap(context, [state.id]);
      },
    ],
    [
      'Ungroup',
      (): void => {
        ungroup(context, state.id);
      },
    ],
  ];
  return (
    <InspectorActions>
      {actions.map(([label, action]) => (
        <InspectorButton key={label} onClick={action}>
          {label}
        </InspectorButton>
      ))}
      <DeleteButton context={context} selection={selection} />
    </InspectorActions>
  );
}

function CompositeInspector(props: Shared & { state: StateNode }): ReactElement {
  const { model, context, isReadOnly, selection, state } = props;
  const regions: string = `${String(state.regions)} concurrent regions`;
  return (
    <InspectorCard title="Composite state" subtitle={state.id} isReadOnly={isReadOnly}>
      <IdField state={state} context={context} selection={selection} />
      <NameField state={state} context={context} />
      <SelectField
        label="Direction inside"
        value={state.dir}
        groups={INSIDE_DIRECTION_OPTIONS}
        onChange={(dir) => {
          updateState(context, state.id, { dir });
        }}
      />
      <Membership model={model} state={state} context={context} />
      {state.regions > 0 ? <InspectorNote>{regions}</InspectorNote> : null}
      <CompositeActions context={context} selection={selection} state={state} />
    </InspectorCard>
  );
}

function DescriptionField({
  state,
  context,
}: {
  state: StateNode;
  context: StateActionContext;
}): ReactElement {
  return (
    <CommitField
      label="Description"
      isMultiline
      placeholder="One line per row"
      value={state.desc.join('\n')}
      onCommit={(text) => {
        const desc: string[] = text
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        updateState(context, state.id, { desc });
      }}
    />
  );
}

function kindPatch(type: StateType): Partial<StateNode> {
  return type === 'state' ? { type } : { type, name: '', desc: [] };
}

const TITLES: Readonly<Record<StateType, string>> = {
  state: 'State',
  choice: 'Choice',
  fork: 'Fork',
  join: 'Join',
};

function PlainActions({
  context,
  selection,
  state,
}: Pick<Shared, 'context' | 'selection'> & { state: StateNode }): ReactElement {
  return (
    <InspectorActions>
      <InspectorButton
        onClick={() => {
          wrap(context, [state.id]);
        }}
      >
        Wrap in composite
      </InspectorButton>
      {state.type === 'state' ? (
        <InspectorButton
          onClick={() => {
            addNoteOn(context, state.id);
          }}
        >
          Add note
        </InspectorButton>
      ) : null}
      <DeleteButton context={context} selection={selection} />
    </InspectorActions>
  );
}

function PlainInspector(props: Shared & { state: StateNode }): ReactElement {
  const { model, context, isReadOnly, selection, state } = props;
  return (
    <InspectorCard title={TITLES[state.type]} subtitle={state.id} isReadOnly={isReadOnly}>
      <IdField state={state} context={context} selection={selection} />
      {state.type === 'state' ? <NameField state={state} context={context} /> : null}
      {state.type === 'state' ? <DescriptionField state={state} context={context} /> : null}
      <ChoiceField
        label="Kind"
        value={state.type}
        choices={KIND_CHOICES}
        onChange={(type) => {
          updateState(context, state.id, kindPatch(type));
        }}
      />
      <Membership model={model} state={state} context={context} />
      <PlainActions context={context} selection={selection} state={state} />
    </InspectorCard>
  );
}

function TransitionInspector(
  props: Shared & { transition: StateTransition; shouldFocusLabel: boolean },
): ReactElement {
  const { model, context, isReadOnly, transition } = props;
  return (
    <InspectorCard
      title="Transition"
      subtitle={`${endName(model, transition.from)} → ${endName(model, transition.to)}`}
      isReadOnly={isReadOnly}
    >
      <CommitField
        label="Label"
        value={transition.label}
        placeholder="event [guard] / action"
        shouldFocus={props.shouldFocusLabel}
        onCommit={(label) => {
          updateTransition(context, transition.id, { label: label.trim() });
        }}
      />
      <InspectorActions>
        <InspectorButton
          onClick={() => {
            reverseTransition(context, transition.id);
          }}
        >
          Reverse
        </InspectorButton>
        <DeleteButton context={context} selection={{ ...NO_SELECTION, edges: [transition.id] }} />
      </InspectorActions>
    </InspectorCard>
  );
}

/** The inspector for one selected leaf or frame: a [*], a note, a composite or a plain state. */
function ItemInspector({ id, ...shared }: Shared & { id: string }): ReactElement | null {
  const pseudo: Pseudo | null = pseudoOf(id);
  if (pseudo) {
    return <PseudoInspector {...shared} pseudo={pseudo} />;
  }
  const note: StateNote | undefined = shared.model.notes.find((item) => item.id === id);
  if (note !== undefined) {
    return <NoteInspector {...shared} note={note} />;
  }
  const state: StateNode | undefined = stateById(shared.model, id);
  if (state === undefined) {
    return null;
  }
  return state.isComposite ? (
    <CompositeInspector {...shared} state={state} />
  ) : (
    <PlainInspector {...shared} state={state} />
  );
}

/** The floating inspector (M1, v1's `Inspector`) for what is selected; nothing when nothing is. */
export function StateInspector({
  shouldFocusEdgeLabel,
  ...shared
}: StateInspectorProps): ReactElement | null {
  const { model, selection } = shared;
  if (selection.nodes.length > 1) {
    return <ManyInspector {...shared} />;
  }
  const one: string | null = selection.nodes[0] ?? selection.group;
  if (one !== null) {
    return <ItemInspector {...shared} id={one} />;
  }
  const transition: StateTransition | undefined = model.transitions.find(
    (item) => item.id === selection.edges[0],
  );
  if (selection.edges.length === 1 && transition !== undefined) {
    return (
      <TransitionInspector
        {...shared}
        transition={transition}
        shouldFocusLabel={shouldFocusEdgeLabel}
      />
    );
  }
  return null;
}
