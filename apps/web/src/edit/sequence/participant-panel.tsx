import { KIND_NAMES } from '@nautink/editors/sequence/constants';
import { participantRefs, validParticipantId } from '@nautink/editors/sequence/participants';
import { toast } from 'sonner';

import {
  boxParticipants,
  removeBox,
  renameParticipant,
  setParticipantBox,
  updateBox,
  updateParticipant,
} from './sequence-actions.ts';
import { addNoteOn } from './sequence-add.ts';
import { ColorField, KindPicker } from './sequence-inspector-parts.tsx';
import { deleteSelection } from './sequence-moves.ts';
import { boxName } from './sequence-names.ts';
import { fromLines, toLines } from './sequence-text.ts';
import { InspectorActions, InspectorButton, InspectorCard } from '../canvas/inspector-card.tsx';
import { CommitField, SelectField } from '../canvas/inspector-fields.tsx';

import type { SequenceActionContext } from './sequence-actions.ts';
import type { SelectOption } from '../canvas/inspector-fields.tsx';
import type { Participant, SequenceBox, SequenceModel } from '@nautink/editors/sequence/types';
import type { ReactElement } from 'react';

interface PanelProps {
  model: SequenceModel;
  context: SequenceActionContext;
  isReadOnly: boolean;
}

/** Checks a new id before renaming: Mermaid ids are letters, digits, `_` and `.`, and unique. */
function renameTo(context: SequenceActionContext, from: string, text: string): void {
  const to: string = text.trim();
  const isTaken: boolean =
    to !== from &&
    context.getModel()?.participants.some((participant) => participant.id === to) === true;
  if (!validParticipantId(to)) {
    toast.error(`"${to}" cannot be a participant id. Use letters, digits, _ and . only.`);
  } else if (isTaken) {
    toast.error(`There is already a participant with the id "${to}".`);
  } else {
    renameParticipant(context, from, to);
  }
}

function deleteText(refs: number): string {
  if (refs === 0) {
    return 'Delete';
  }
  return `Delete + ${String(refs)} ${refs === 1 ? 'row' : 'rows'}`;
}

function BoxMembership({
  model,
  participant,
  context,
}: Omit<PanelProps, 'isReadOnly'> & { participant: Participant }): ReactElement {
  if (participant.isCreated) {
    return <p className="text-xs text-muted-foreground">Created by a message (create).</p>;
  }
  const options: SelectOption[] = [
    { value: '', label: 'None' },
    ...model.boxes.map((box) => ({ value: box.id, label: boxName(model, box.id) })),
    { value: 'new', label: 'New box…' },
  ];
  return (
    <SelectField
      label="Box"
      value={participant.box ?? ''}
      groups={[{ label: 'Boxes', options }]}
      onChange={(box) => {
        setParticipantBox(context, participant.id, box === '' ? null : box);
      }}
    />
  );
}

/** Several participants: put them in one box, or delete them with every row on them (v1). */
export function ParticipantsPanel({
  model,
  context,
  isReadOnly,
  ids,
}: PanelProps & { ids: readonly string[] }): ReactElement {
  const canBox: boolean = model.participants.some(
    (participant) => ids.includes(participant.id) && !participant.isCreated,
  );
  return (
    <InspectorCard
      title={`${String(ids.length)} participants`}
      subtitle={ids.join(', ')}
      isReadOnly={isReadOnly}
    >
      <InspectorActions>
        {canBox ? (
          <InspectorButton
            onClick={() => {
              boxParticipants(context, ids);
            }}
          >
            Put in a box
          </InspectorButton>
        ) : null}
        <InspectorButton
          isDestructive
          onClick={() => {
            deleteSelection(context);
          }}
        >
          Delete
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}

/** One participant: its name, id, kind, box, and the rows that go with it on delete (v1). */
export function ParticipantPanel({
  model,
  context,
  isReadOnly,
  participant,
}: PanelProps & { participant: Participant }): ReactElement {
  const refs: number = participantRefs(model, participant.id);
  return (
    <InspectorCard
      title={KIND_NAMES[participant.kind]}
      subtitle={participant.id}
      isReadOnly={isReadOnly}
    >
      <CommitField
        label="Display name"
        isMultiline
        value={toLines(participant.label)}
        onCommit={(text) => {
          updateParticipant(context, participant.id, {
            label: fromLines(text).trim() || participant.id,
          });
        }}
      />
      <CommitField
        label="Id (used in code)"
        value={participant.id}
        onCommit={(text) => {
          renameTo(context, participant.id, text);
        }}
      />
      <KindPicker
        value={participant.kind}
        onChange={(kind) => {
          updateParticipant(context, participant.id, { kind });
        }}
      />
      <BoxMembership model={model} participant={participant} context={context} />
      <InspectorActions>
        <InspectorButton
          onClick={() => {
            addNoteOn(context, participant.id);
          }}
        >
          Add note
        </InspectorButton>
        <InspectorButton
          isDestructive
          onClick={() => {
            deleteSelection(context);
          }}
        >
          {deleteText(refs)}
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}

/** A box: its title and color; removing it keeps its participants. */
export function BoxPanel({
  context,
  isReadOnly,
  box,
}: Omit<PanelProps, 'model'> & { box: SequenceBox }): ReactElement {
  return (
    <InspectorCard title="Box" isReadOnly={isReadOnly}>
      <CommitField
        label="Title"
        value={box.name}
        placeholder="None"
        onCommit={(name) => {
          updateBox(context, box.id, { name });
        }}
      />
      <ColorField
        label="Color"
        value={box.fill === 'transparent' ? '' : box.fill}
        placeholder="transparent"
        onCommit={(fill) => {
          updateBox(context, box.id, { fill: fill === '' ? 'transparent' : fill });
        }}
      />
      <InspectorActions>
        <InspectorButton
          onClick={() => {
            removeBox(context, box.id);
          }}
        >
          Remove box
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}
