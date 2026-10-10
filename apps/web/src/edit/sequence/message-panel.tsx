import { HEADS } from '@nautink/editors/sequence/constants';
import { msgSource } from '@nautink/editors/sequence/model';

import { reverseMessage, updateItem, wrapRows } from './sequence-actions.ts';
import { addNoteOn } from './sequence-add.ts';
import { ArrowIcon } from './sequence-glyphs.tsx';
import { GridChoice, ParticipantSelect, WrapButtons } from './sequence-inspector-parts.tsx';
import { deleteSelection } from './sequence-moves.ts';
import { fromLines, toLines } from './sequence-text.ts';
import {
  InspectorActions,
  InspectorButton,
  InspectorCard,
  InspectorSection,
} from '../canvas/inspector-card.tsx';
import { ChoiceField, CommitField, SelectField } from '../canvas/inspector-fields.tsx';

import type { SequenceActionContext } from './sequence-actions.ts';
import type { Choice, SelectOption } from '../canvas/inspector-fields.tsx';
import type {
  Activation,
  Central,
  HeadKind,
  LineStyle,
  MessageItem,
  SequenceModel,
} from '@nautink/editors/sequence/types';
import type { ReactElement } from 'react';

const MAIN_HEADS: readonly HeadKind[] = ['arrow', 'open', 'cross', 'async', 'bi'];
const HALF_HEADS: readonly HeadKind[] = (Object.keys(HEADS) as HeadKind[]).filter(
  (head) => !MAIN_HEADS.includes(head),
);

const LINES: readonly Choice<LineStyle>[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dotted', label: 'Dotted' },
];

const ACTIVATIONS: readonly Choice<Activation | 'none'>[] = [
  { value: 'none', label: 'None' },
  { value: '+', label: '+ target', name: 'Activate the target' },
  { value: '-', label: '− source', name: 'Deactivate the source' },
];

const CENTRALS: readonly SelectOption[] = [
  { value: '', label: 'None' },
  { value: 'to', label: 'At target ()' },
  { value: 'from', label: 'At source ()' },
  { value: 'both', label: 'Both ends' },
];

function isCentral(value: string): value is Central {
  return CENTRALS.some((option) => option.value === value);
}

function isHead(value: string): value is HeadKind {
  return Object.hasOwn(HEADS, value);
}

interface MessagePanelProps {
  model: SequenceModel;
  message: MessageItem;
  context: SequenceActionContext;
  isReadOnly: boolean;
}

function HeadPicker({
  message,
  context,
}: Pick<MessagePanelProps, 'message' | 'context'>): ReactElement {
  const halfOptions: SelectOption[] = [
    { value: '', label: 'None' },
    ...HALF_HEADS.map((head) => ({ value: head, label: HEADS[head].name })),
  ];
  return (
    <InspectorSection label="Arrowhead">
      <div className="grid grid-cols-5 gap-1">
        {MAIN_HEADS.map((head) => (
          <GridChoice
            key={head}
            label={HEADS[head].name}
            isPressed={message.head === head}
            onClick={() => {
              updateItem(context, message.id, { head });
            }}
          >
            <ArrowIcon line={message.line} head={head} />
          </GridChoice>
        ))}
      </div>
      <SelectField
        label="Half arrows"
        value={HALF_HEADS.includes(message.head) ? message.head : ''}
        groups={[{ label: 'Half arrows', options: halfOptions }]}
        onChange={(head) => {
          if (isHead(head)) {
            updateItem(context, message.id, { head });
          }
        }}
      />
      <code className="truncate font-mono text-2xs text-muted-foreground">
        {msgSource({ ...message, text: '' }).replace(/:$/, '')}
      </code>
    </InspectorSection>
  );
}

function ActivationFields({
  message,
  context,
}: Pick<MessagePanelProps, 'message' | 'context'>): ReactElement {
  const activation: Activation = message.central === '' ? message.act : '';
  return (
    <>
      <ChoiceField
        label="Activation"
        value={activation === '' ? 'none' : activation}
        choices={ACTIVATIONS}
        onChange={(value) => {
          const act: Activation = value === 'none' ? '' : value;
          updateItem(context, message.id, { act, central: act === '' ? message.central : '' });
        }}
      />
      <SelectField
        label="Central connection"
        value={message.central}
        groups={[{ label: 'Central connection', options: CENTRALS }]}
        onChange={(central) => {
          if (isCentral(central)) {
            updateItem(context, message.id, { central, act: central === '' ? message.act : '' });
          }
        }}
      />
    </>
  );
}

function MessageEnds({
  model,
  message,
  context,
}: Omit<MessagePanelProps, 'isReadOnly'>): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ParticipantSelect
        label="From"
        model={model}
        value={message.from}
        onChange={(from) => {
          updateItem(context, message.id, { from });
        }}
      />
      <ParticipantSelect
        label="To"
        model={model}
        value={message.to}
        onChange={(to) => {
          updateItem(context, message.id, { to });
        }}
      />
    </div>
  );
}

function MessageActions({
  message,
  context,
}: Pick<MessagePanelProps, 'message' | 'context'>): ReactElement {
  return (
    <InspectorActions>
      {message.from === message.to ? null : (
        <InspectorButton
          onClick={() => {
            reverseMessage(context, message.id);
          }}
        >
          Reverse
        </InspectorButton>
      )}
      <InspectorButton
        onClick={() => {
          addNoteOn(context, message.to, message.id);
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
        Delete
      </InspectorButton>
    </InspectorActions>
  );
}

/** A message: text, ends, line, arrowhead, activation and central connections (v1's MessagePanel). */
export function MessagePanel({
  model,
  message,
  context,
  isReadOnly,
}: MessagePanelProps): ReactElement {
  return (
    <InspectorCard
      title="Message"
      subtitle={`${message.from} → ${message.to}`}
      isReadOnly={isReadOnly}
    >
      <CommitField
        label="Text"
        isMultiline
        placeholder="None"
        value={toLines(message.text)}
        onCommit={(text) => {
          updateItem(context, message.id, { text: fromLines(text) });
        }}
      />
      <MessageEnds model={model} message={message} context={context} />
      <ChoiceField
        label="Line"
        value={message.line}
        choices={LINES}
        onChange={(line) => {
          updateItem(context, message.id, { line });
        }}
      />
      <HeadPicker message={message} context={context} />
      <ActivationFields message={message} context={context} />
      <WrapButtons
        onWrap={(kind) => {
          wrapRows(context, [message.id], kind);
        }}
      />
      <MessageActions message={message} context={context} />
    </InspectorCard>
  );
}
