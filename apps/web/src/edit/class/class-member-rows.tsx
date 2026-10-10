import { Button } from '@nautink/ui/components/button';
import { Plus } from 'lucide-react';

import {
  addAttr,
  addMethod,
  moveMember,
  removeMember,
  updateAttr,
  updateMethod,
} from './class-member-actions.ts';
import { ClassifierToggle, MemberCell, MemberMenu, VisibilitySelect } from './member-controls.tsx';
import { InspectorSection } from '../canvas/inspector-card.tsx';

import type { ClassActionContext } from './class-action-context.ts';
import type { MemberList } from '@nautink/editors/class/ops';
import type { ClassAttr, ClassItem, ClassMethod } from '@nautink/editors/class/types';
import type { ReactElement, ReactNode } from 'react';

interface RowsProps {
  item: ClassItem;
  context: ClassActionContext;
}

function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}): ReactElement {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 self-start px-2 text-muted-foreground"
      onClick={onClick}
    >
      <Plus aria-hidden="true" />
      {children}
    </Button>
  );
}

function rowMenu(
  context: ClassActionContext,
  item: ClassItem,
  list: MemberList,
): (index: number) => ReactElement {
  const count: number = item[list].length;
  const word: string = list === 'methods' ? 'Method' : 'Attribute';
  return (index: number): ReactElement => (
    <MemberMenu
      label={`${word} ${String(index + 1)}`}
      index={index}
      count={count}
      onMove={(delta) => {
        moveMember(context, { classId: item.id, list, index, delta });
      }}
      onRemove={() => {
        removeMember(context, { classId: item.id, list, index });
      }}
    />
  );
}

function AttributeRow({
  item,
  context,
  attr,
  index,
}: RowsProps & { attr: ClassAttr; index: number }): ReactElement {
  const name: string = `Attribute ${String(index + 1)}`;
  const patch = (change: Partial<ClassAttr>): void => {
    updateAttr(context, { classId: item.id, index, patch: change });
  };
  return (
    <div className="flex items-center gap-1">
      <VisibilitySelect
        label={`Visibility of ${name.toLowerCase()}`}
        value={attr.vis}
        onChange={(vis) => {
          patch({ vis });
        }}
      />
      <MemberCell
        label={name}
        value={attr.text}
        placeholder="Type name"
        onCommit={(text) => {
          patch({ text });
        }}
      />
      <ClassifierToggle
        label={`Static ${name.toLowerCase()}`}
        text="S"
        isOn={attr.cls === '$'}
        onToggle={() => {
          patch({ cls: attr.cls === '$' ? '' : '$' });
        }}
      />
      {rowMenu(context, item, 'attrs')(index)}
    </div>
  );
}

/** The attributes (or an enumeration's values), editable, reorderable and removable (v1). */
export function AttributeRows({ item, context }: RowsProps): ReactElement {
  const isEnumLike: boolean = item.annotations[0]?.toLowerCase() === 'enumeration';
  return (
    <InspectorSection label={isEnumLike ? 'Values' : 'Attributes'}>
      {item.attrs.map((attr, index) => (
        // Members have no identity of their own; their order is the key.
        <AttributeRow key={String(index)} item={item} context={context} attr={attr} index={index} />
      ))}
      <AddButton
        onClick={() => {
          addAttr(context, item.id, isEnumLike);
        }}
      >
        {isEnumLike ? 'Value' : 'Attribute'}
      </AddButton>
    </InspectorSection>
  );
}

interface MethodLineProps {
  method: ClassMethod;
  name: string;
  patch: (change: Partial<ClassMethod>) => void;
}

function MethodSignature({ method, name, patch }: MethodLineProps): ReactElement {
  return (
    <div className="flex items-center gap-1">
      <VisibilitySelect
        label={`Visibility of ${name}`}
        value={method.vis}
        onChange={(vis) => {
          patch({ vis });
        }}
      />
      <MemberCell
        label={`Name of ${name}`}
        value={method.name}
        placeholder="name"
        onCommit={(text) => {
          patch({ name: text });
        }}
      />
      <span className="font-mono text-faint">(</span>
      <MemberCell
        label={`Parameters of ${name}`}
        value={method.params}
        placeholder="params"
        onCommit={(text) => {
          patch({ params: text });
        }}
      />
      <span className="font-mono text-faint">)</span>
    </div>
  );
}

function MethodReturn({
  method,
  name,
  patch,
  menu,
}: MethodLineProps & { menu: ReactElement }): ReactElement {
  const toggle = (classifier: string): void => {
    patch({ cls: method.cls === classifier ? '' : classifier });
  };
  return (
    <div className="flex items-center gap-1">
      <span className="w-3 shrink-0 text-center font-mono text-faint">:</span>
      <MemberCell
        label={`Return type of ${name}`}
        value={method.ret}
        placeholder="return type"
        onCommit={(text) => {
          patch({ ret: text });
        }}
      />
      <ClassifierToggle
        label={`Static ${name}`}
        text="S"
        isOn={method.cls === '$'}
        onToggle={() => {
          toggle('$');
        }}
      />
      <ClassifierToggle
        label={`Abstract ${name}`}
        text="A"
        isOn={method.cls === '*'}
        onToggle={() => {
          toggle('*');
        }}
      />
      {menu}
    </div>
  );
}

function MethodRow({
  item,
  context,
  method,
  index,
}: RowsProps & { method: ClassMethod; index: number }): ReactElement {
  const name: string = `method ${String(index + 1)}`;
  const patch = (change: Partial<ClassMethod>): void => {
    updateMethod(context, { classId: item.id, index, patch: change });
  };
  return (
    <div
      role="group"
      aria-label={`Method ${String(index + 1)}`}
      className="flex flex-col gap-1 border-b border-dashed border-border-subtle pb-1.5"
    >
      <MethodSignature method={method} name={name} patch={patch} />
      <MethodReturn
        method={method}
        name={name}
        patch={patch}
        menu={rowMenu(context, item, 'methods')(index)}
      />
    </div>
  );
}

/** The methods: visibility, name, parameters, return type, static and abstract (v1). */
export function MethodRows({ item, context }: RowsProps): ReactElement {
  return (
    <InspectorSection label="Methods">
      {item.methods.map((method, index) => (
        // Members have no identity of their own; their order is the key.
        <MethodRow
          key={String(index)}
          item={item}
          context={context}
          method={method}
          index={index}
        />
      ))}
      <AddButton
        onClick={() => {
          addMethod(context, item.id);
        }}
      >
        Method
      </AddButton>
    </InspectorSection>
  );
}
