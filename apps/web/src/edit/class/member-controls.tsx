import { Button } from '@nautink/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@nautink/ui/components/dropdown-menu';
import { Input } from '@nautink/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nautink/ui/components/select';
import { Toggle } from '@nautink/ui/components/toggle';
import { Ellipsis } from 'lucide-react';
import { useState } from 'react';

import type { KeyboardEvent, ReactElement } from 'react';

export interface MemberCellProps {
  /** The accessible name ("Attribute 1", "Return type of method 2"). */
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (text: string) => void;
}

function CellEditor({ label, value, placeholder, onCommit }: MemberCellProps): ReactElement {
  const [text, setText] = useState<string>(value);
  return (
    <Input
      aria-label={label}
      title={label}
      value={text}
      placeholder={placeholder}
      className="h-7 min-w-0 flex-1 bg-subtle px-1.5 font-mono text-xs shadow-none"
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

/** One label-less member field (v1's `Cell`): commits on blur or Enter, Esc reverts. */
export function MemberCell(props: MemberCellProps): ReactElement {
  // A new value from outside (undo, Claude) restarts the field with it.
  return <CellEditor key={props.value} {...props} />;
}

const NO_VISIBILITY: string = 'none';

const VISIBILITIES: readonly { value: string; label: string }[] = [
  { value: NO_VISIBILITY, label: '·  None' },
  { value: '+', label: '+  Public' },
  { value: '-', label: '-  Private' },
  { value: '#', label: '#  Protected' },
  { value: '~', label: '~  Package' },
];

/** A member's visibility: + - # ~ or none. */
export function VisibilitySelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <Select
      value={value === '' ? NO_VISIBILITY : value}
      onValueChange={(next) => {
        onChange(next === NO_VISIBILITY ? '' : next);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={label}
        className="h-7 w-11 shrink-0 gap-0.5 bg-subtle px-1.5 font-mono text-xs shadow-none"
      >
        <SelectValue>{value === '' ? '·' : value}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper">
        {VISIBILITIES.map((option) => (
          <SelectItem key={option.value} value={option.value} className="font-mono text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A classifier toggle: S for static (`$`), A for abstract (`*`). */
export function ClassifierToggle({
  label,
  text,
  isOn,
  onToggle,
}: {
  label: string;
  text: string;
  isOn: boolean;
  onToggle: () => void;
}): ReactElement {
  return (
    <Toggle
      size="sm"
      aria-label={label}
      title={label}
      pressed={isOn}
      onPressedChange={onToggle}
      className="h-7 min-w-7 shrink-0 rounded-control border border-border px-0 font-mono text-xs data-[state=on]:border-accent-ink data-[state=on]:bg-accent-wash data-[state=on]:text-accent-ink-strong"
    >
      {text}
    </Toggle>
  );
}

export interface MemberMenuProps {
  /** "Attribute 1", "Method 2". */
  label: string;
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

/** A member's row actions (v1's ↑ ↓ ×): move up, move down, remove. */
export function MemberMenu({
  label,
  index,
  count,
  onMove,
  onRemove,
}: MemberMenuProps): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${label} actions`}
          className="size-7 shrink-0 rounded-control text-muted-foreground"
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={index === 0}
          onSelect={() => {
            onMove(-1);
          }}
        >
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={index === count - 1}
          onSelect={() => {
            onMove(1);
          }}
        >
          Move down
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={onRemove}>
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
