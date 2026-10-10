import { KEYS } from '@nautink/editors/er/model';
import { Button } from '@nautink/ui/components/button';
import { Input } from '@nautink/ui/components/input';
import { IconButton } from '@nautink/ui/icon-button';
import { cn } from '@nautink/ui/lib/utils';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useState } from 'react';

import {
  addAttribute,
  moveAttribute,
  removeAttribute,
  toggleKey,
  updateAttribute,
} from './er-actions.ts';
import { InspectorSection } from '../canvas/inspector-card.tsx';

import type { ErActionContext } from './er-actions.ts';
import type { ErAttribute, ErEntity, ErKey } from '@nautink/editors/er/model';
import type { KeyboardEvent, ReactElement } from 'react';

const KEY_NAMES: Readonly<Record<ErKey, string>> = {
  PK: 'Primary key',
  FK: 'Foreign key',
  UK: 'Unique key',
};

const KEY_ON: Readonly<Record<ErKey, string>> = {
  PK: 'aria-pressed:bg-warning',
  FK: 'aria-pressed:bg-accent-ink',
  UK: 'aria-pressed:bg-success',
};

interface CellProps {
  label: string;
  value: string;
  placeholder?: string;
  className?: string;
  onCommit: (text: string) => void;
}

function CellEditor({ label, value, placeholder, className, onCommit }: CellProps): ReactElement {
  const [text, setText] = useState<string>(value);
  return (
    <Input
      aria-label={label}
      value={text}
      placeholder={placeholder}
      className={cn('h-7 min-w-0 bg-subtle px-1.5 text-xs shadow-none', className)}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onBlur={() => {
        if (text !== value) {
          onCommit(text);
        }
      }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          setText(value);
        }
      }}
    />
  );
}

/** A compact cell that commits on blur or Enter and reverts on Esc (v1's `Cell`). */
function Cell(props: CellProps): ReactElement {
  // A new value from outside (undo, Claude) restarts the cell with it.
  return <CellEditor key={props.value} {...props} />;
}

interface RowProps {
  entity: ErEntity;
  attribute: ErAttribute;
  index: number;
  context: ErActionContext;
}

function KeyToggles({ entity, attribute, index, context }: RowProps): ReactElement {
  return (
    <div className="flex gap-0.5">
      {KEYS.map((key) => (
        <Button
          key={key}
          type="button"
          variant="outline"
          size="xs"
          title={KEY_NAMES[key]}
          aria-label={KEY_NAMES[key]}
          aria-pressed={attribute.keys.includes(key)}
          className={cn(
            'h-6 px-1.5 text-[11px] font-semibold text-muted-foreground',
            'aria-pressed:border-transparent aria-pressed:text-panel',
            KEY_ON[key],
          )}
          onClick={() => {
            toggleKey(context, { entityName: entity.name, index, key });
          }}
        >
          {key}
        </Button>
      ))}
    </div>
  );
}

function RowTools({ entity, index, context }: RowProps): ReactElement {
  const ref: { entityName: string; index: number } = { entityName: entity.name, index };
  return (
    <div className="flex">
      <IconButton
        label="Move up"
        icon={<ArrowUp />}
        className="size-6"
        disabled={index === 0}
        onClick={() => {
          moveAttribute(context, { ...ref, delta: -1 });
        }}
      />
      <IconButton
        label="Move down"
        icon={<ArrowDown />}
        className="size-6"
        disabled={index === entity.attributes.length - 1}
        onClick={() => {
          moveAttribute(context, { ...ref, delta: 1 });
        }}
      />
      <IconButton
        label="Remove attribute"
        icon={<X />}
        className="size-6 hover:text-destructive"
        onClick={() => {
          removeAttribute(context, ref);
        }}
      />
    </div>
  );
}

function AttributeRow(props: RowProps): ReactElement {
  const { entity, attribute, index, context } = props;
  const commit = (patch: Partial<ErAttribute>): void => {
    updateAttribute(context, { entityName: entity.name, index, patch });
  };
  return (
    <li
      aria-label={`Attribute ${attribute.name}`}
      className="flex flex-col gap-1 rounded-control border border-border-subtle p-1.5"
    >
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-1">
        <Cell
          label="Attribute type"
          value={attribute.type}
          onCommit={(type) => {
            commit({ type });
          }}
        />
        <Cell
          label="Attribute name"
          value={attribute.name}
          className="font-medium"
          onCommit={(name) => {
            commit({ name });
          }}
        />
      </div>
      <Cell
        label="Attribute comment"
        value={attribute.comment}
        placeholder="Comment"
        className="italic"
        onCommit={(comment) => {
          commit({ comment });
        }}
      />
      <div className="flex items-center justify-between">
        <KeyToggles {...props} />
        <RowTools {...props} />
      </div>
    </li>
  );
}

/** The entity's attributes: type, name, keys and comment, reordered and removed in place (v1). */
export function AttributeTable({
  entity,
  context,
}: {
  entity: ErEntity;
  context: ErActionContext;
}): ReactElement {
  return (
    <InspectorSection label="Attributes">
      {entity.attributes.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {entity.attributes.map((attribute, index) => (
            <AttributeRow
              // Attributes have no identity of their own; their order and name are the key.
              key={`${String(index)}:${attribute.name}`}
              entity={entity}
              attribute={attribute}
              index={index}
              context={context}
            />
          ))}
        </ul>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          addAttribute(context, entity.name);
        }}
      >
        <Plus aria-hidden="true" />
        Add attribute
      </Button>
    </InspectorSection>
  );
}
