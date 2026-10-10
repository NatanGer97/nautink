// Inspector panels for notes, activations, autonumber rows and several selected rows.
import { siblingRange } from '@nautink/editors/sequence/tree';

import { setAutonumberStart, updateItem, wrapRows } from './sequence-actions.ts';
import { ParticipantSelect, WrapButtons } from './sequence-inspector-parts.tsx';
import { deleteSelection } from './sequence-moves.ts';
import { rowsLabel } from './sequence-names.ts';
import { fromLines, toLines } from './sequence-text.ts';
import { InspectorActions, InspectorButton, InspectorCard } from '../canvas/inspector-card.tsx';
import { ChoiceField, CommitField } from '../canvas/inspector-fields.tsx';

import type { SequenceActionContext } from './sequence-actions.ts';
import type { Choice } from '../canvas/inspector-fields.tsx';
import type {
  ActivationItem,
  AutonumberItem,
  NoteItem,
  NotePlacement,
  SequenceModel,
} from '@nautink/editors/sequence/types';
import type { ReactElement } from 'react';

interface PanelProps {
  model: SequenceModel;
  context: SequenceActionContext;
  isReadOnly: boolean;
}

const PLACEMENTS: readonly Choice<NotePlacement>[] = [
  { value: 'left', label: 'Left of' },
  { value: 'over', label: 'Over' },
  { value: 'right', label: 'Right of' },
];

const SWITCHES: readonly Choice<'on' | 'off'>[] = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

function DeleteRow({ context }: { context: SequenceActionContext }): ReactElement {
  return (
    <InspectorActions>
      <InspectorButton
        isDestructive
        onClick={() => {
          deleteSelection(context);
        }}
      >
        Delete
      </InspectorButton>
    </InspectorActions>
  );
}

/** A note over one participant, or spanning to a second one. */
function spanTo(first: string, second: string): string[] {
  return second !== '' && second !== first ? [first, second] : [first];
}

/** The typed start number; none (continue the count) when it is empty or not a number. */
function startOf(text: string): number | undefined {
  const start: number = Number.parseInt(text, 10);
  return Number.isNaN(start) ? undefined : start;
}

function NoteActors({
  model,
  note,
  context,
}: Omit<PanelProps, 'isReadOnly'> & { note: NoteItem }): ReactElement {
  const [first = '', second = ''] = note.actors;
  const isOver: boolean = note.placement === 'over';
  return (
    <>
      <ParticipantSelect
        label={isOver ? 'From' : 'Participant'}
        model={model}
        value={first}
        onChange={(actor) => {
          updateItem(context, note.id, {
            actors: [...new Set<string>([actor, ...note.actors.slice(1)])],
          });
        }}
      />
      {isOver ? (
        <ParticipantSelect
          label="To (optional)"
          model={model}
          value={second}
          hasNone
          onChange={(actor) => {
            updateItem(context, note.id, { actors: spanTo(first, actor) });
          }}
        />
      ) : null}
    </>
  );
}

/** A note: text, placement and the participants it sits on (v1's NotePanel). */
export function NotePanel({
  model,
  context,
  isReadOnly,
  note,
}: PanelProps & { note: NoteItem }): ReactElement {
  return (
    <InspectorCard title="Note" isReadOnly={isReadOnly}>
      <CommitField
        label="Text"
        isMultiline
        value={toLines(note.text)}
        onCommit={(text) => {
          updateItem(context, note.id, { text: fromLines(text) });
        }}
      />
      <ChoiceField
        label="Placement"
        value={note.placement}
        choices={PLACEMENTS}
        onChange={(placement) => {
          updateItem(context, note.id, {
            placement,
            actors: placement === 'over' ? note.actors : note.actors.slice(0, 1),
          });
        }}
      />
      <NoteActors model={model} note={note} context={context} />
      <WrapButtons
        onWrap={(kind) => {
          wrapRows(context, [note.id], kind);
        }}
      />
      <DeleteRow context={context} />
    </InspectorCard>
  );
}

/** An explicit `activate` / `deactivate` row. */
export function ActivationPanel({
  model,
  context,
  isReadOnly,
  item,
}: PanelProps & { item: ActivationItem }): ReactElement {
  return (
    <InspectorCard title={item.isOn ? 'Activate' : 'Deactivate'} isReadOnly={isReadOnly}>
      <ParticipantSelect
        label="Participant"
        model={model}
        value={item.actor}
        onChange={(actor) => {
          updateItem(context, item.id, { actor });
        }}
      />
      <ChoiceField
        label="Action"
        value={item.isOn ? 'on' : 'off'}
        choices={[
          { value: 'on', label: 'Activate' },
          { value: 'off', label: 'Deactivate' },
        ]}
        onChange={(value) => {
          updateItem(context, item.id, { isOn: value === 'on' });
        }}
      />
      <DeleteRow context={context} />
    </InspectorCard>
  );
}

/** An `autonumber` row after the first message: on or off, and where it restarts. */
export function AutonumberPanel({
  context,
  isReadOnly,
  item,
}: Omit<PanelProps, 'model'> & { item: AutonumberItem }): ReactElement {
  return (
    <InspectorCard title="Autonumber" isReadOnly={isReadOnly}>
      <ChoiceField
        label="Numbering"
        value={item.isVisible ? 'on' : 'off'}
        choices={SWITCHES}
        onChange={(value) => {
          updateItem(context, item.id, { isVisible: value === 'on' });
        }}
      />
      {item.isVisible ? (
        <CommitField
          label="Start at"
          placeholder="Continue"
          value={String(item.start ?? '')}
          onCommit={(text) => {
            setAutonumberStart(context, item.id, startOf(text));
          }}
        />
      ) : null}
      <DeleteRow context={context} />
    </InspectorCard>
  );
}

/** Several rows: wrap them in a block when they are neighbours, or delete them. */
export function RowsPanel({
  model,
  context,
  isReadOnly,
  ids,
}: PanelProps & { ids: readonly string[] }): ReactElement {
  const isWrappable: boolean = siblingRange(model, ids) !== null;
  return (
    <InspectorCard title={rowsLabel(ids.length)} isReadOnly={isReadOnly}>
      <WrapButtons
        isDisabled={!isWrappable}
        onWrap={(kind) => {
          wrapRows(context, ids, kind);
        }}
      />
      {isWrappable ? null : (
        <p className="text-xs text-muted-foreground">
          Select neighbouring rows in the same block to wrap them.
        </p>
      )}
      <DeleteRow context={context} />
    </InspectorCard>
  );
}
