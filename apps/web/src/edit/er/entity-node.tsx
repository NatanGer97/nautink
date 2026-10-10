import { displayName } from '@nautink/editors/er/model';
import { cn } from '@nautink/ui/lib/utils';
import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';

import { useErEditorContext } from './er-context.ts';
import { InlineInput } from './er-inline-input.tsx';
import { entityBox } from './er-layout.ts';

import type { EntityFlowNode } from './er-types.ts';
import type { ErAttribute, ErEntity, ErKey } from '@nautink/editors/er/model';
import type { EntityColumns, EntityLayout } from '@nautink/editors/er/size';
import type { NodeProps } from '@xyflow/react';
import type { NamedExoticComponent, ReactElement } from 'react';

const SIDES: readonly (readonly [string, Position])[] = [
  ['t', Position.Top],
  ['r', Position.Right],
  ['b', Position.Bottom],
  ['l', Position.Left],
];

/** The font `@nautink/editors/er/size` measures with, so the text fits the box it sized. */
const MEASURED_FONT: string = '[font-family:ui-sans-serif,system-ui,sans-serif]';

const KEY_CLASS: Readonly<Record<ErKey, string>> = {
  PK: 'bg-warning',
  FK: 'bg-accent-ink',
  UK: 'bg-success',
};

const KEY_NAMES: Readonly<Record<ErKey, string>> = {
  PK: 'Primary key',
  FK: 'Foreign key',
  UK: 'Unique key',
};

/** A dot on each side: drag from one to relate (links attach to the facing sides). */
export function Handles(): ReactElement {
  return (
    <>
      {SIDES.map(([id, position]) => (
        <Handle key={id} id={id} type="source" position={position} />
      ))}
    </>
  );
}

/** The attribute table's columns; hidden ones (0 px) are left out. */
function gridColumns(cols: EntityColumns): string {
  return [
    cols.type > 0 ? `${String(cols.type)}px` : '',
    'minmax(0,1fr)',
    cols.keys > 0 ? `${String(cols.keys)}px` : '',
    cols.comment > 0 ? `${String(cols.comment)}px` : '',
  ]
    .filter((column) => column !== '')
    .join(' ');
}

export function KeyBadge({ keyName }: { keyName: ErKey }): ReactElement {
  return (
    <b
      title={KEY_NAMES[keyName]}
      className={cn(
        'inline-grid h-3.5 w-[19px] place-items-center rounded-xs text-[9px] leading-none font-semibold text-panel',
        KEY_CLASS[keyName],
      )}
    >
      {keyName}
    </b>
  );
}

const STRIPE_EVERY: number = 2;
const CELL: string = 'flex h-[22px] min-w-0 items-center overflow-hidden px-2.5 whitespace-nowrap';

function AttributeRow({
  attribute,
  cols,
  isStriped,
}: {
  attribute: ErAttribute;
  cols: EntityColumns;
  isStriped: boolean;
}): ReactElement {
  const cell: string = cn(CELL, isStriped && 'bg-muted/60');
  return (
    <div className="contents">
      {cols.type > 0 ? (
        <span className={cn(cell, 'text-xs text-muted-foreground')}>{attribute.type}</span>
      ) : null}
      <span className={cn(cell, 'text-xs font-semibold')}>{attribute.name}</span>
      {cols.keys > 0 ? (
        <span className={cn(cell, 'gap-[3px] pr-1.5 pl-0')}>
          {attribute.keys.map((key) => (
            <KeyBadge key={key} keyName={key} />
          ))}
        </span>
      ) : null}
      {cols.comment > 0 ? (
        <span
          title={attribute.comment}
          className={cn(
            cell,
            'block truncate text-[11px] leading-[22px] text-muted-foreground italic',
          )}
        >
          {attribute.comment}
        </span>
      ) : null}
    </div>
  );
}

function EntityTitle({ entity }: { entity: ErEntity }): ReactElement {
  return (
    <>
      <span className="truncate text-[13px] font-semibold">{displayName(entity)}</span>
      {entity.alias ? (
        <span className="text-[11px] text-muted-foreground">{entity.name}</span>
      ) : null}
    </>
  );
}

function EntityHeader({ id, entity }: { id: string; entity: ErEntity }): ReactElement {
  const { editingId, setEditingId, renameEntity, isReadOnly } = useErEditorContext();
  const isEditing: boolean = editingId === id && !isReadOnly;
  const hasRows: boolean = entity.attributes.length > 0;
  return (
    <div
      title={entity.alias ? `${entity.alias} (${entity.name})` : entity.name}
      className={cn(
        'flex items-center justify-center gap-1.5 overflow-hidden rounded-t-[5px] bg-subtle px-2.5 whitespace-nowrap',
        hasRows ? 'h-[31px] flex-none border-b border-node-stroke' : 'flex-1 rounded-b-[5px]',
      )}
    >
      {isEditing ? (
        <InlineInput
          label="Entity name"
          value={displayName(entity)}
          className="border border-ring text-center text-[13px] font-semibold"
          onDone={(text) => {
            setEditingId(null);
            if (text !== null) {
              renameEntity(id, text);
            }
          }}
        />
      ) : (
        <EntityTitle entity={entity} />
      )}
    </div>
  );
}

function EntityNodeView({
  id,
  data,
  selected: isSelected,
}: NodeProps<EntityFlowNode>): ReactElement {
  const { entity } = data;
  const { width, height, cols }: EntityLayout = entityBox(entity);
  return (
    <div
      data-testid={`er-node-${id}`}
      aria-label={`Entity ${displayName(entity)}`}
      className={cn(
        'relative flex flex-col rounded-md border border-node-stroke bg-node-fill text-foreground',
        MEASURED_FONT,
        isSelected && 'border-accent-ink ring-[3px] ring-selection-ring',
      )}
      style={{ width, height }}
    >
      <EntityHeader id={id} entity={entity} />
      {entity.attributes.length > 0 ? (
        <div className="grid py-0.5" style={{ gridTemplateColumns: gridColumns(cols) }}>
          {entity.attributes.map((attribute, index) => (
            <AttributeRow
              // Attributes have no identity of their own; their order and name are the key.
              key={`${String(index)}:${attribute.name}`}
              attribute={attribute}
              cols={cols}
              isStriped={index % STRIPE_EVERY === 1}
            />
          ))}
        </div>
      ) : null}
      <Handles />
    </div>
  );
}

/** One entity table: its name (and alias), its attributes with key badges, and its handles. */
export const EntityNode: NamedExoticComponent<NodeProps<EntityFlowNode>> = memo(EntityNodeView);
