import { KINDS, kindOf, MARKS } from '@nautink/editors/class/model';

import { deleteSelection } from './class-item-actions.ts';
import { relationName } from './class-names.ts';
import { reverseRelation, setRelationKind, updateRelation } from './class-note-actions.ts';
import { NO_SELECTION } from './class-types.ts';
import { InspectorActions, InspectorButton, InspectorCard } from '../canvas/inspector-card.tsx';
import { ChoiceField, CommitField, SelectField } from '../canvas/inspector-fields.tsx';

import type { ClassActionContext } from './class-action-context.ts';
import type { Choice, SelectOption } from '../canvas/inspector-fields.tsx';
import type { ClassLine, ClassMark, ClassModel, ClassRelation } from '@nautink/editors/class/types';
import type { ReactElement } from 'react';

export interface RelationPanelProps {
  model: ClassModel;
  relation: ClassRelation;
  context: ClassActionContext;
  isReadOnly: boolean;
  /** A double-clicked relation opens with its label field focused. */
  shouldFocusLabel: boolean;
}

const LINES: readonly Choice<ClassLine>[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
];

const MARK_OPTIONS: SelectOption[] = MARKS.map(([value, label]) => ({ value, label }));

function kindOptions(kind: string): SelectOption[] {
  const known: SelectOption[] = KINDS.map((item) => ({ value: item.id, label: item.name }));
  return kind === 'custom' ? [...known, { value: 'custom', label: 'Custom' }] : known;
}

function isMark(value: string): value is ClassMark {
  return MARKS.some(([mark]) => mark === value);
}

function LollipopPanel({
  relation,
  context,
  isReadOnly,
}: Omit<RelationPanelProps, 'model' | 'shouldFocusLabel'>): ReactElement {
  const end: 'from' | 'to' = relation.t1 === 'lolli' ? 'from' : 'to';
  return (
    <InspectorCard title="Lollipop interface" subtitle={relation[end]} isReadOnly={isReadOnly}>
      <CommitField
        label="Interface"
        value={relation[end]}
        onCommit={(text) => {
          if (text.trim() !== '') {
            updateRelation(context, relation.id, { [end]: text.trim().replace(/\s+/g, '_') });
          }
        }}
      />
      <InspectorActions>
        <InspectorButton
          isDestructive
          onClick={() => {
            deleteSelection(context, { ...NO_SELECTION, edges: [relation.id] });
          }}
        >
          Delete
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}

function EndFields({
  relation,
  context,
}: Pick<RelationPanelProps, 'relation' | 'context'>): ReactElement {
  const setMark =
    (key: 't1' | 't2') =>
    (value: string): void => {
      if (isMark(value)) {
        updateRelation(context, relation.id, { [key]: value });
      }
    };
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <CommitField
          label={`At ${relation.from}`}
          value={relation.m1}
          placeholder="e.g. 1"
          onCommit={(text) => {
            updateRelation(context, relation.id, { m1: text.trim() });
          }}
        />
        <CommitField
          label={`At ${relation.to}`}
          value={relation.m2}
          placeholder="e.g. 0..*"
          onCommit={(text) => {
            updateRelation(context, relation.id, { m2: text.trim() });
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="Start end"
          value={relation.t1}
          groups={[{ label: 'Ends', options: MARK_OPTIONS }]}
          onChange={setMark('t1')}
        />
        <SelectField
          label="End end"
          value={relation.t2}
          groups={[{ label: 'Ends', options: MARK_OPTIONS }]}
          onChange={setMark('t2')}
        />
      </div>
    </>
  );
}

/** A relation: kind, label, multiplicities, ends and line (v1's RelationPanel); or a lollipop. */
export function RelationPanel(props: RelationPanelProps): ReactElement {
  const { model, relation, context, isReadOnly } = props;
  const kind: string = kindOf(relation);
  if (kind === 'lollipop') {
    return <LollipopPanel relation={relation} context={context} isReadOnly={isReadOnly} />;
  }
  return (
    <InspectorCard
      title="Relation"
      subtitle={relationName(model, relation.id)}
      isReadOnly={isReadOnly}
    >
      <SelectField
        label="Kind"
        value={kind}
        groups={[{ label: 'Kinds', options: kindOptions(kind) }]}
        onChange={(next) => {
          setRelationKind(context, relation.id, next);
        }}
      />
      <CommitField
        label="Label"
        value={relation.label}
        placeholder="None"
        shouldFocus={props.shouldFocusLabel}
        onCommit={(text) => {
          updateRelation(context, relation.id, { label: text.trim() });
        }}
      />
      <EndFields relation={relation} context={context} />
      <ChoiceField
        label="Line"
        value={relation.line}
        choices={LINES}
        onChange={(line) => {
          updateRelation(context, relation.id, { line });
        }}
      />
      <InspectorActions>
        <InspectorButton
          onClick={() => {
            reverseRelation(context, relation.id);
          }}
        >
          Reverse
        </InspectorButton>
        <InspectorButton
          isDestructive
          onClick={() => {
            deleteSelection(context, { ...NO_SELECTION, edges: [relation.id] });
          }}
        >
          Delete
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}
