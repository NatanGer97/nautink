import { Input } from '@nautink/ui/components/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@nautink/ui/components/select';
import { Textarea } from '@nautink/ui/components/textarea';
import { ToggleGroup, ToggleGroupItem } from '@nautink/ui/components/toggle-group';
import { useEffect, useId, useRef, useState } from 'react';

import type { KeyboardEvent, ReactElement, RefObject } from 'react';

export interface CommitFieldProps {
  label: string;
  value: string;
  /** Called on blur or Enter when the text changed, so typing never writes code per keystroke. */
  onCommit: (text: string) => void;
  isMultiline?: boolean;
  placeholder?: string;
  /** Takes focus when shown (a double-clicked link label). */
  shouldFocus?: boolean;
}

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

/** What the input and the textarea share. */
interface FieldControl {
  id: string;
  value: string;
  placeholder: string | undefined;
  onChange: (event: { target: { value: string } }) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<FieldElement>) => void;
}

function useFocusOnMount(ref: RefObject<FieldElement | null>, shouldFocus: boolean): void {
  useEffect(() => {
    if (shouldFocus) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [ref, shouldFocus]);
}

function useFieldControl(
  { value, onCommit, placeholder }: CommitFieldProps,
  id: string,
): FieldControl {
  const [text, setText] = useState<string>(value);
  return {
    id,
    value: text,
    placeholder,
    onChange: (event): void => {
      setText(event.target.value);
    },
    onBlur: (): void => {
      if (text !== value) {
        onCommit(text);
      }
    },
    onKeyDown: (event: KeyboardEvent<FieldElement>): void => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        event.currentTarget.blur();
      } else if (event.key === 'Escape') {
        setText(value);
      }
    },
  };
}

function FieldEditor(props: CommitFieldProps): ReactElement {
  const inputRef: RefObject<HTMLInputElement | null> = useRef<HTMLInputElement>(null);
  const textareaRef: RefObject<HTMLTextAreaElement | null> = useRef<HTMLTextAreaElement>(null);
  const id: string = useId();
  const control: FieldControl = useFieldControl(props, id);
  const isMultiline: boolean = props.isMultiline === true;
  useFocusOnMount(isMultiline ? textareaRef : inputRef, props.shouldFocus === true);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {props.label}
      </label>
      {isMultiline ? (
        <Textarea
          ref={textareaRef}
          rows={2}
          {...control}
          className="min-h-14 bg-subtle text-sm shadow-none"
        />
      ) : (
        <Input ref={inputRef} {...control} className="h-8 bg-subtle text-sm shadow-none" />
      )}
    </div>
  );
}

/** A text field that commits on blur or Enter and reverts on Esc (v1's `Field`). */
export function CommitField(props: CommitFieldProps): ReactElement {
  // A new value from outside (undo, Claude) restarts the field with it.
  return <FieldEditor key={props.value} {...props} />;
}

/** One choice of a segmented control. */
export interface Choice<Value extends string> {
  value: Value;
  label: string;
  /** For symbol labels ("→", "○"): the words a screen reader says. */
  name?: string;
}

export interface ChoiceFieldProps<Value extends string> {
  label: string;
  value: Value;
  choices: readonly Choice<Value>[];
  onChange: (value: Value) => void;
}

/** A segmented control (v1's `Seg`), as a shadcn ToggleGroup. */
export function ChoiceField<Value extends string>({
  label,
  value,
  choices,
  onChange,
}: ChoiceFieldProps<Value>): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <ToggleGroup
        type="single"
        aria-label={label}
        value={value}
        onValueChange={(next: string) => {
          const choice: Choice<Value> | undefined = choices.find((item) => item.value === next);
          if (choice !== undefined && next !== value) {
            onChange(choice.value);
          }
        }}
        className="w-full rounded-track bg-muted p-[3px]"
      >
        {choices.map((choice) => (
          <ToggleGroupItem
            key={choice.value}
            value={choice.value}
            aria-label={choice.name ?? choice.label}
            className="h-[26px] flex-1 rounded-control px-2 text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-panel data-[state=on]:text-foreground data-[state=on]:shadow-segment"
          >
            {choice.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectOptionGroup {
  label: string;
  options: readonly SelectOption[];
}

export interface SelectFieldProps {
  label: string;
  /** '' is a real choice here ("None", "Inherit"), unlike in Radix. */
  value: string;
  groups: readonly SelectOptionGroup[];
  onChange: (value: string) => void;
}

/** Radix keeps '' for "no value", so an empty choice travels under this name. */
const EMPTY_VALUE: string = '\u0000empty';

function toRadix(value: string): string {
  return value === '' ? EMPTY_VALUE : value;
}

/** A labelled select with option groups (shape categories, groups, directions). */
export function SelectField({ label, value, groups, onChange }: SelectFieldProps): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select
        value={toRadix(value)}
        onValueChange={(next: string) => {
          onChange(next === EMPTY_VALUE ? '' : next);
        }}
      >
        <SelectTrigger size="sm" aria-label={label} className="w-full bg-subtle shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {groups.map((group) => (
            <SelectGroup key={group.label}>
              {groups.length > 1 ? <SelectLabel>{group.label}</SelectLabel> : null}
              {group.options.map((option) => (
                <SelectItem key={option.value} value={toRadix(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
