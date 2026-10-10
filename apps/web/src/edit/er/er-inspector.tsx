import { CARD_NAMES, CARDS } from '@nautink/editors/er/model';
import { parentMap } from '@nautink/editors/shared/subgraphs';
import { cn } from '@nautink/ui/lib/utils';

import {
  deleteSelection,
  renameEntity,
  reverseRel,
  setEntityGroup,
  ungroup,
  updateEntity,
  updateGroup,
  updateRel,
} from './er-actions.ts';
import { AttributeTable } from './er-attribute-table.tsx';
import { CardIcon } from './er-markers.tsx';
import { endName, entityName, relName } from './er-names.ts';
import { NO_SELECTION } from './er-types.ts';
import {
  InspectorActions,
  InspectorButton,
  InspectorCard,
  InspectorSection,
} from '../canvas/inspector-card.tsx';
import { ChoiceField, CommitField, SelectField } from '../canvas/inspector-fields.tsx';
import { manyTitle } from '../canvas/many-title.ts';

import type { ErActionContext } from './er-actions.ts';
import type { ErCanvasSelection } from './er-types.ts';
import type { Choice, SelectOption } from '../canvas/inspector-fields.tsx';
import type {
  Cardinality,
  ErEntity,
  ErModel,
  ErRelationship,
  ErSubgraph,
} from '@nautink/editors/er/model';
import type { ReactElement } from 'react';

export interface ErInspectorProps {
  model: ErModel;
  selection: ErCanvasSelection;
  context: ErActionContext;
  isReadOnly: boolean;
}

interface Shared {
  model: ErModel;
  context: ErActionContext;
  isReadOnly: boolean;
}

type LineStyle = 'identifying' | 'non-identifying';

const LINES: readonly Choice<LineStyle>[] = [
  { value: 'identifying', label: 'Identifying' },
  { value: 'non-identifying', label: 'Non-identifying' },
];

/** The cardinality choices: the four ends, plus `u` (parent) when a relationship already uses it. */
function CardPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Cardinality;
  onChange: (card: Cardinality) => void;
}): ReactElement {
  const cards: readonly Cardinality[] = value === 'MD_PARENT' ? [...CARDS, 'MD_PARENT'] : CARDS;
  return (
    <InspectorSection label={label}>
      <div className="grid gap-1">
        {cards.map((card) => (
          <button
            key={card}
            type="button"
            aria-pressed={card === value}
            className={cn(
              'flex h-7 min-w-0 items-center gap-1 rounded-control border border-border pr-1.5 text-left text-xs hover:bg-muted disabled:opacity-50',
              'aria-pressed:border-accent-ink aria-pressed:bg-accent-wash',
            )}
            onClick={() => {
              if (card !== value) {
                onChange(card);
              }
            }}
          >
            <CardIcon card={card} />
            <span className="truncate">{CARD_NAMES[card]}</span>
          </button>
        ))}
      </div>
    </InspectorSection>
  );
}

function GroupMembership({
  model,
  entity,
  context,
}: Shared & { entity: ErEntity }): ReactElement | null {
  if (model.subgraphs.length === 0) {
    return null;
  }
  const options: SelectOption[] = [
    { value: '', label: 'None' },
    ...model.subgraphs.map((group) => ({
      value: group.id,
      label: group.title === '' ? group.id : group.title,
    })),
  ];
  return (
    <SelectField
      label="Group"
      value={parentMap(model.subgraphs).get(entity.name) ?? ''}
      groups={[{ label: 'Groups', options }]}
      onChange={(groupId) => {
        setEntityGroup(context, entity.name, groupId === '' ? null : groupId);
      }}
    />
  );
}

function EntityInspector(props: Shared & { entity: ErEntity }): ReactElement {
  const { entity, context, isReadOnly } = props;
  return (
    <InspectorCard title="Entity" subtitle={entity.name} isReadOnly={isReadOnly}>
      <CommitField
        label="Name"
        value={entity.name}
        onCommit={(text) => {
          renameEntity(context, entity.name, text);
        }}
      />
      <CommitField
        label="Alias (display label)"
        value={entity.alias}
        placeholder="None"
        onCommit={(alias) => {
          updateEntity(context, entity.name, { alias });
        }}
      />
      <AttributeTable entity={entity} context={context} />
      <GroupMembership {...props} />
      {entity.classes.length > 0 ? (
        <InspectorSection label="Classes">
          <code className="font-mono text-xs text-muted-foreground">
            {entity.classes.join(' ')}
          </code>
        </InspectorSection>
      ) : null}
      <InspectorActions>
        <InspectorButton
          isDestructive
          onClick={() => {
            deleteSelection(context, { ...NO_SELECTION, entities: [entity.name] });
          }}
        >
          Delete entity
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}

function RelInspector({
  model,
  rel,
  context,
  isReadOnly,
}: Shared & { rel: ErRelationship }): ReactElement {
  return (
    <InspectorCard title="Relationship" subtitle={relName(model, rel.id)} isReadOnly={isReadOnly}>
      <CommitField
        label="Label"
        value={rel.label}
        placeholder="Required by Mermaid"
        onCommit={(label) => {
          updateRel(context, rel.id, { label });
        }}
      />
      <CardPicker
        label={`At ${endName(model, rel.from)}`}
        value={rel.fromCard}
        onChange={(fromCard) => {
          updateRel(context, rel.id, { fromCard });
        }}
      />
      <CardPicker
        label={`At ${endName(model, rel.to)}`}
        value={rel.toCard}
        onChange={(toCard) => {
          updateRel(context, rel.id, { toCard });
        }}
      />
      <ChoiceField
        label="Line"
        value={rel.isIdentifying ? 'identifying' : 'non-identifying'}
        choices={LINES}
        onChange={(line) => {
          updateRel(context, rel.id, { isIdentifying: line === 'identifying' });
        }}
      />
      <InspectorActions>
        <InspectorButton
          onClick={() => {
            reverseRel(context, rel.id);
          }}
        >
          Reverse
        </InspectorButton>
        <InspectorButton
          isDestructive
          onClick={() => {
            deleteSelection(context, { ...NO_SELECTION, rels: [rel.id] });
          }}
        >
          Delete
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}

function GroupInspector({
  group,
  context,
  isReadOnly,
}: Shared & { group: ErSubgraph }): ReactElement {
  return (
    <InspectorCard title="Group" subtitle={group.id} isReadOnly={isReadOnly}>
      <CommitField
        label="Title"
        value={group.title}
        placeholder={group.id}
        onCommit={(title) => {
          updateGroup(context, group.id, { title });
        }}
      />
      <InspectorActions>
        <InspectorButton
          onClick={() => {
            ungroup(context, group.id);
          }}
        >
          Ungroup
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}

function ManyInspector({
  model,
  selection,
  context,
  isReadOnly,
}: Shared & { selection: ErCanvasSelection }): ReactElement {
  const names: string = [
    ...selection.entities.map((name) => entityName(model, name)),
    ...selection.rels.map((id) => relName(model, id)),
  ].join(', ');
  const title: string = manyTitle([
    { count: selection.entities.length, plural: 'entities' },
    { count: selection.rels.length, plural: 'relationships' },
  ]);
  return (
    <InspectorCard title={title} subtitle={names} isReadOnly={isReadOnly}>
      <InspectorActions>
        <InspectorButton
          isDestructive
          onClick={() => {
            deleteSelection(context, selection);
          }}
        >
          Delete
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}

/** The floating inspector (M1) for what is selected: an entity, a relationship, a group or several items. */
export function ErInspector({
  model,
  selection,
  context,
  isReadOnly,
}: ErInspectorProps): ReactElement | null {
  const shared: Shared = { model, context, isReadOnly };
  if (selection.entities.length + selection.rels.length > 1) {
    return <ManyInspector {...shared} selection={selection} />;
  }
  const entity: ErEntity | undefined = model.entities.find(
    (item) => item.name === selection.entities[0],
  );
  if (entity !== undefined) {
    return <EntityInspector {...shared} entity={entity} />;
  }
  const rel: ErRelationship | undefined = model.rels.find((item) => item.id === selection.rels[0]);
  if (selection.rels.length === 1 && rel !== undefined) {
    return <RelInspector {...shared} rel={rel} />;
  }
  const group: ErSubgraph | undefined = model.subgraphs.find((item) => item.id === selection.group);
  return group === undefined ? null : <GroupInspector {...shared} group={group} />;
}
