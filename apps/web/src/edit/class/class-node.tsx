import { className as displayName } from '@nautink/editors/class/measure';
import { isAbstract } from '@nautink/editors/class/model';
import {
  attrDisplay,
  attrSource,
  methodDisplay,
  methodSource,
  readable,
} from '@nautink/editors/class/text';
import { cn } from '@nautink/ui/lib/utils';
import { memo } from 'react';

import { useClassNodeContext } from './class-context.ts';
import { ClassHandles } from './class-handles.tsx';
import { InlineEditor } from './inline-editor.tsx';
import { DARK_CODE_NODE_FILL } from '../canvas/code-colors.ts';

import type { ClassFlowNode } from './class-types.ts';
import type { MemberList } from '@nautink/editors/class/ops';
import type { ClassStyle } from '@nautink/editors/class/styles';
import type { ClassItem } from '@nautink/editors/class/types';
import type { NodeProps } from '@xyflow/react';
import type { CSSProperties, NamedExoticComponent, ReactElement } from 'react';

interface MemberProps {
  classId: string;
  list: MemberList;
  index: number;
  vis: string;
  classifier: string;
  text: string;
  source: string;
}

/** One attribute or method row; double-click edits its source text in place (v1). */
function Member({
  classId,
  list,
  index,
  vis,
  classifier,
  text,
  source,
}: MemberProps): ReactElement {
  const { editing, setEditing, setMemberText, isReadOnly } = useClassNodeContext();
  const isEditing: boolean =
    !isReadOnly &&
    editing?.id === classId &&
    editing.part === list &&
    'index' in editing &&
    editing.index === index;
  if (isEditing) {
    return (
      <InlineEditor
        label={list === 'methods' ? 'Method' : 'Attribute'}
        value={source}
        className="h-[18px] font-mono text-xs"
        onDone={(next) => {
          setEditing(null);
          if (next !== null && next !== source) {
            setMemberText({ classId, list, index, text: next });
          }
        }}
      />
    );
  }
  return (
    <div
      title={source}
      className="group/member flex h-[18px] cursor-text items-center whitespace-nowrap"
      onDoubleClick={(event) => {
        if (!isReadOnly) {
          event.stopPropagation();
          setEditing({ id: classId, part: list, index });
        }
      }}
    >
      <span className="w-[13px] shrink-0 text-faint">{vis}</span>
      <span
        className={cn(
          'truncate group-hover/member:text-accent-ink',
          classifier === '$' && 'underline',
          classifier === '*' && 'italic',
        )}
      >
        {text}
      </span>
    </div>
  );
}

function ClassName({ id, item }: { id: string; item: ClassItem }): ReactElement {
  const { editing, setEditing, renameClass, isReadOnly } = useClassNodeContext();
  if (!isReadOnly && editing?.id === id && editing.part === 'name') {
    return (
      <InlineEditor
        label="Class name"
        value={readable(item.label === '' ? item.id : item.label)}
        className="h-[19px] text-center text-sm font-semibold"
        onDone={(text) => {
          setEditing(null);
          if (text !== null) {
            renameClass(id, text);
          }
        }}
      />
    );
  }
  return (
    <div
      className={cn(
        'cursor-text truncate text-sm leading-[19px] font-semibold',
        isAbstract(item) && 'italic',
      )}
      onDoubleClick={(event) => {
        if (!isReadOnly) {
          event.stopPropagation();
          setEditing({ id, part: 'name' });
        }
      }}
    >
      {displayName(item)}
    </div>
  );
}

function Compartment({
  id,
  item,
  list,
}: {
  id: string;
  item: ClassItem;
  list: MemberList;
}): ReactElement {
  const rows: ReactElement[] =
    list === 'attrs'
      ? item.attrs.map((attr, index) => (
          // Members have no identity of their own; their order is the key.
          <Member
            key={String(index)}
            classId={id}
            list="attrs"
            index={index}
            vis={attr.vis}
            classifier={attr.cls}
            text={attrDisplay(attr)}
            source={attrSource(attr)}
          />
        ))
      : item.methods.map((method, index) => (
          <Member
            key={String(index)}
            classId={id}
            list="methods"
            index={index}
            vis={method.vis}
            classifier={method.cls}
            text={methodDisplay(method)}
            source={methodSource(method)}
          />
        ));
  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden border-t border-border font-mono text-xs',
        rows.length === 0 ? 'h-2' : 'px-2.5 py-1',
      )}
    >
      {rows}
    </div>
  );
}

/** True when the code colors this class (`style`, `classDef`): dark mode then tones it down. */
function hasCodeColors(style: ClassStyle | undefined): boolean {
  return style !== undefined && ('--node-fill' in style || 'color' in style);
}

function ClassNodeView({ id, data, selected: isSelected }: NodeProps<ClassFlowNode>): ReactElement {
  const { item, size, style } = data;
  return (
    <div
      data-testid={`class-node-${id}`}
      aria-label={`Class ${displayName(item)}`}
      className={cn(
        'relative box-border flex flex-col rounded-control border border-node-stroke bg-node-fill text-foreground',
        hasCodeColors(style) && DARK_CODE_NODE_FILL,
        isSelected && 'border-accent-ink shadow-[0_0_0_3px_var(--selection-ring)]',
      )}
      style={{ width: size.width, height: size.height, ...(style as CSSProperties | undefined) }}
    >
      <div className="shrink-0 overflow-hidden px-2.5 py-1.5 text-center">
        {item.annotations.map((annotation, index) => (
          <div
            key={String(index)}
            className="truncate text-2xs leading-[15px] text-muted-foreground"
          >
            «{readable(annotation)}»
          </div>
        ))}
        <ClassName id={id} item={item} />
      </div>
      <Compartment id={id} item={item} list="attrs" />
      <Compartment id={id} item={item} list="methods" />
      <ClassHandles />
    </div>
  );
}

/** A UML class box (v1's ClassNode): stereotypes, name with generics, attributes and methods. */
export const ClassNode: NamedExoticComponent<NodeProps<ClassFlowNode>> = memo(ClassNodeView);
