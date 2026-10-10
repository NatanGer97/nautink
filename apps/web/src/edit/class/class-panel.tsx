import { readable } from '@nautink/editors/class/text';

import { StereotypeField, NamespaceSelect } from './class-inspector-fields.tsx';
import {
  deleteSelection,
  duplicateClasses,
  renameClassId,
  setStereotype,
  updateClass,
} from './class-item-actions.ts';
import { AttributeRows, MethodRows } from './class-member-rows.tsx';
import { setClassNamespace } from './class-namespace-actions.ts';
import { addNoteFor } from './class-note-actions.ts';
import { NO_SELECTION } from './class-types.ts';
import { InspectorActions, InspectorButton, InspectorCard } from '../canvas/inspector-card.tsx';
import { CommitField } from '../canvas/inspector-fields.tsx';

import type { ClassActionContext } from './class-action-context.ts';
import type { ClassItem, ClassModel } from '@nautink/editors/class/types';
import type { ReactElement } from 'react';

export interface ClassPanelProps {
  model: ClassModel;
  item: ClassItem;
  context: ClassActionContext;
  isReadOnly: boolean;
}

function ClassFields({ model, item, context }: Omit<ClassPanelProps, 'isReadOnly'>): ReactElement {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <CommitField
          label="Name"
          value={item.id}
          onCommit={(text) => {
            renameClassId(context, item.id, text);
          }}
        />
        <CommitField
          label="Generic"
          value={item.generic}
          placeholder="e.g. T"
          onCommit={(text) => {
            updateClass(context, item.id, { generic: text.replace(/~/g, '').trim() });
          }}
        />
      </div>
      <CommitField
        label="Display label"
        value={readable(item.label)}
        placeholder="Same as name"
        onCommit={(text) => {
          updateClass(context, item.id, { label: text.trim() });
        }}
      />
      <StereotypeField
        value={item.annotations[0] ?? ''}
        onChange={(value) => {
          setStereotype(context, item.id, value);
        }}
      />
      <NamespaceSelect
        model={model}
        value={item.ns}
        onChange={(choice) => {
          setClassNamespace(context, item.id, choice);
        }}
      />
    </>
  );
}

/** A class: name, generic, label, stereotype, namespace, attributes and methods (v1's ClassPanel). */
export function ClassPanel({ model, item, context, isReadOnly }: ClassPanelProps): ReactElement {
  return (
    <InspectorCard title="Class" subtitle={item.id} isReadOnly={isReadOnly}>
      <ClassFields model={model} item={item} context={context} />
      <AttributeRows item={item} context={context} />
      <MethodRows item={item} context={context} />
      <InspectorActions>
        <InspectorButton
          onClick={() => {
            addNoteFor(context, item.id);
          }}
        >
          Add note
        </InspectorButton>
        <InspectorButton
          onClick={() => {
            duplicateClasses(context, [item.id]);
          }}
        >
          Duplicate
        </InspectorButton>
        <InspectorButton
          isDestructive
          onClick={() => {
            deleteSelection(context, { ...NO_SELECTION, nodes: [item.id] });
          }}
        >
          Delete
        </InspectorButton>
      </InspectorActions>
    </InspectorCard>
  );
}
