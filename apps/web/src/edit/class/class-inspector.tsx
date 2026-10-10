import { lolliId } from '@nautink/editors/class/layout';
import { noteLines, nsLeaf, readable } from '@nautink/editors/class/text';

import { NamespaceSelect } from './class-inspector-fields.tsx';
import { deleteSelection, duplicateClasses } from './class-item-actions.ts';
import { itemKind } from './class-names.ts';
import {
  groupInNamespace,
  renameNamespace,
  setNoteNamespace,
  ungroupNamespace,
  updateNamespace,
} from './class-namespace-actions.ts';
import { setNoteText, updateNote } from './class-note-actions.ts';
import { ClassPanel } from './class-panel.tsx';
import { NO_SELECTION } from './class-types.ts';
import { RelationPanel } from './relation-panel.tsx';
import { InspectorActions, InspectorButton, InspectorCard } from '../canvas/inspector-card.tsx';
import { CommitField, SelectField } from '../canvas/inspector-fields.tsx';

import type { ClassActionContext } from './class-action-context.ts';
import type { ClassSelection } from './class-types.ts';
import type { SelectOption } from '../canvas/inspector-fields.tsx';
import type {
  ClassItem,
  ClassModel,
  ClassNamespace,
  ClassNote,
  ClassRelation,
} from '@nautink/editors/class/types';
import type { ReactElement } from 'react';

export interface ClassInspectorProps {
  model: ClassModel;
  selection: ClassSelection;
  context: ClassActionContext;
  isReadOnly: boolean;
  /** A double-clicked relation opens with its label field focused. */
  shouldFocusEdgeLabel: boolean;
}

interface PanelBase {
  model: ClassModel;
  context: ClassActionContext;
  isReadOnly: boolean;
}

function NotePanel({
  model,
  note,
  context,
  isReadOnly,
}: PanelBase & { note: ClassNote }): ReactElement {
  const owners: SelectOption[] = [
    { value: '', label: 'Nothing (free note)' },
    ...model.classes.map((item) => ({ value: item.id, label: item.id })),
  ];
  return (
    <InspectorCard title="Note" isReadOnly={isReadOnly}>
      <CommitField
        label="Text"
        isMultiline
        value={noteLines(note.text).join('\n')}
        onCommit={(text) => {
          setNoteText(context, note.id, text);
        }}
      />
      <SelectField
        label="Attached to"
        value={note.for}
        groups={[{ label: 'Classes', options: owners }]}
        onChange={(forId) => {
          updateNote(context, note.id, { for: forId });
        }}
      />
      <NamespaceSelect
        model={model}
        value={note.ns}
        onChange={(choice) => {
          setNoteNamespace(context, note.id, choice);
        }}
      />
      <InspectorActions>
        <InspectorButton
          isDestructive
          onClick={() => {
            deleteSelection(context, { ...NO_SELECTION, nodes: [note.id] });
          }}
        >
          Delete
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}

function NamespacePanel({
  model,
  id,
  context,
  isReadOnly,
}: PanelBase & { id: string }): ReactElement {
  const namespace: ClassNamespace = model.namespaces.find((item) => item.id === id) ?? {
    id,
    label: '',
  };
  return (
    <InspectorCard title="Namespace" subtitle={id} isReadOnly={isReadOnly}>
      <CommitField
        label="Name"
        value={nsLeaf(id)}
        onCommit={(text) => {
          renameNamespace(context, id, text);
        }}
      />
      <CommitField
        label="Label"
        value={readable(namespace.label)}
        placeholder={nsLeaf(id)}
        onCommit={(text) => {
          updateNamespace(context, id, { label: text.trim() });
        }}
      />
      <InspectorActions>
        <InspectorButton
          onClick={() => {
            ungroupNamespace(context, id);
          }}
        >
          Ungroup
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}

function ManyPanel({
  model,
  selection,
  context,
  isReadOnly,
}: PanelBase & { selection: ClassSelection }): ReactElement {
  const count: number = selection.nodes.length + selection.edges.length;
  const classIds: string[] = selection.nodes.filter((id) => itemKind(model, id) === 'class');
  return (
    <InspectorCard title={`${String(count)} items`} isReadOnly={isReadOnly}>
      <InspectorActions>
        {classIds.length > 0 ? (
          <>
            <InspectorButton
              onClick={() => {
                groupInNamespace(context, selection.nodes);
              }}
            >
              Group in namespace
            </InspectorButton>
            <InspectorButton
              onClick={() => {
                duplicateClasses(context, classIds);
              }}
            >
              Duplicate
            </InspectorButton>
          </>
        ) : null}
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

/** The relation whose lollipop circle is the one selected node, if it is one. */
function lollipopOf(model: ClassModel, id: string | undefined): ClassRelation | undefined {
  return model.relations.find((relation) => lolliId(relation) === id);
}

function NodePanel({
  model,
  id,
  context,
  isReadOnly,
}: PanelBase & { id: string | undefined }): ReactElement | null {
  const item: ClassItem | undefined = model.classes.find((candidate) => candidate.id === id);
  if (item !== undefined) {
    return <ClassPanel model={model} item={item} context={context} isReadOnly={isReadOnly} />;
  }
  const note: ClassNote | undefined = model.notes.find((candidate) => candidate.id === id);
  if (note !== undefined) {
    return <NotePanel model={model} note={note} context={context} isReadOnly={isReadOnly} />;
  }
  const relation: ClassRelation | undefined = lollipopOf(model, id);
  return relation === undefined ? null : (
    <RelationPanel
      model={model}
      relation={relation}
      context={context}
      isReadOnly={isReadOnly}
      shouldFocusLabel={false}
    />
  );
}

/** The floating inspector (M1) for what is selected: a class, a note, a relation, a namespace or many items. */
export function ClassInspector(props: ClassInspectorProps): ReactElement | null {
  const { model, selection, context, isReadOnly } = props;
  const base: PanelBase = { model, context, isReadOnly };
  if (selection.nodes.length + selection.edges.length > 1) {
    return <ManyPanel {...base} selection={selection} />;
  }
  if (selection.nodes.length === 1) {
    return <NodePanel {...base} id={selection.nodes[0]} />;
  }
  const relation: ClassRelation | undefined = model.relations.find(
    (item) => item.id === selection.edges[0],
  );
  if (relation !== undefined) {
    return (
      <RelationPanel {...base} relation={relation} shouldFocusLabel={props.shouldFocusEdgeLabel} />
    );
  }
  return selection.group === null ? null : <NamespacePanel {...base} id={selection.group} />;
}
