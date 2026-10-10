import { Button } from '@nautink/ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@nautink/ui/components/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nautink/ui/components/select';
import { IconButton } from '@nautink/ui/icon-button';
import { cn } from '@nautink/ui/lib/utils';
import { CircleHelp } from 'lucide-react';

import type { DragEvent, ReactElement, ReactNode } from 'react';

/** The floating tools card in the canvas's top-left corner (M1). Editors fill it. */
export function EditorToolbar({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      role="toolbar"
      aria-label="Editor tools"
      data-canvas-chrome=""
      className="absolute top-4 left-4 z-10 flex items-center gap-0.5 rounded-card border bg-panel p-1 shadow-float"
    >
      {children}
    </div>
  );
}

export function ToolbarSeparator(): ReactElement {
  return <div aria-hidden="true" className="mx-1 h-[18px] w-px bg-border" />;
}

export interface ToolbarIconButtonProps {
  label: string;
  icon: ReactNode;
  shortcut?: string;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick: () => void;
  /** Lets the tool be dragged onto the canvas (a shape), as well as clicked. */
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
}

/** An icon tool with its name and shortcut in a tooltip. */
export function ToolbarIconButton({
  isDisabled = false,
  onDragStart,
  ...props
}: ToolbarIconButtonProps): ReactElement {
  return (
    <IconButton
      {...props}
      isDisabled={isDisabled}
      draggable={onDragStart !== undefined && !isDisabled}
      {...(onDragStart ? { onDragStart } : {})}
    />
  );
}

export interface ToolbarTextButtonProps {
  children: ReactNode;
  /** For toggles (Library): announced as pressed and drawn with the accent wash. */
  isPressed?: boolean;
  isDisabled?: boolean;
  onClick: () => void;
}

/** A worded tool ("Library", "Auto layout"). */
export function ToolbarTextButton({
  children,
  isPressed,
  isDisabled = false,
  onClick,
}: ToolbarTextButtonProps): ReactElement {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={isPressed}
      disabled={isDisabled}
      className={cn(
        'h-7 rounded-control px-2 font-medium',
        'aria-pressed:bg-accent-wash aria-pressed:text-accent-ink-strong',
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export interface ToolbarSelectProps {
  /** The accessible name ("Direction"). */
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  isDisabled?: boolean;
  onChange: (value: string) => void;
}

/** A compact select in the toolbar (the diagram's direction). */
export function ToolbarSelect({
  label,
  value,
  options,
  isDisabled = false,
  onChange,
}: ToolbarSelectProps): ReactElement {
  return (
    <Select value={value} onValueChange={onChange} disabled={isDisabled}>
      <SelectTrigger
        size="sm"
        aria-label={label}
        className="h-7 gap-1 border-transparent px-2 font-medium shadow-none hover:bg-muted"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** "How to use" behind a ? button: the editor's gestures and shortcuts. */
export function ToolbarHelp({ tips }: { tips: readonly string[] }): ReactElement {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="How to use"
          className="size-7 rounded-control text-muted-foreground"
        >
          <CircleHelp aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-xs">
        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-muted-foreground">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
