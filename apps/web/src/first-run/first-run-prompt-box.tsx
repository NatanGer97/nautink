import { Button } from '@nautink/ui/components/button';
import { ToggleGroup, ToggleGroupItem } from '@nautink/ui/components/toggle-group';
import { useState } from 'react';

import {
  FIRST_RUN_EXAMPLES,
  FIRST_RUN_TYPES,
  firstRunType,
  startFromPrompt,
} from './first-run-prompt.ts';
import { useChosenModelLabel } from '../settings/models.ts';

import type { KeyboardEvent, ReactElement } from 'react';

function TypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}): ReactElement {
  return (
    <ToggleGroup
      type="single"
      spacing={0.5}
      value={value}
      aria-label="Diagram type"
      className="flex-wrap rounded-track bg-muted p-0.5"
      onValueChange={(next: string) => {
        if (next !== '') {
          onChange(next);
        }
      }}
    >
      {FIRST_RUN_TYPES.map((type) => (
        <ToggleGroupItem
          key={type.id}
          value={type.id}
          className="h-[26px] rounded-control px-2.5 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-panel data-[state=on]:text-foreground data-[state=on]:shadow-segment"
        >
          {type.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** "What do you want to diagram?": the prompt, the type picker and the example chips (M8). */
export function FirstRunPromptBox(): ReactElement {
  const [text, setText] = useState<string>('');
  const [typeId, setTypeId] = useState<string>('auto');
  const modelName: string = useChosenModelLabel();
  const submit = (): void => {
    startFromPrompt(text, firstRunType(typeId));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };
  return (
    <>
      <div className="flex flex-col gap-2.5 rounded-dialog border border-input bg-panel px-3.5 pt-3.5 pb-2.5 shadow-float focus-within:border-ring">
        <label htmlFor="first-run-prompt" className="sr-only">
          Describe your diagram
        </label>
        <textarea
          id="first-run-prompt"
          rows={3}
          value={text}
          placeholder="The checkout flow for an online store, with payment retries and manual review…"
          className="resize-none border-0 bg-transparent text-[15px] leading-normal outline-none placeholder:text-faint"
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        <div className="flex items-center justify-between gap-2.5">
          <TypePicker value={typeId} onChange={setTypeId} />
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-faint">{modelName}</span>
            <Button size="sm" disabled={text.trim() === ''} onClick={submit}>
              Create
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {FIRST_RUN_EXAMPLES.map((example) => (
          <button
            key={example.text}
            type="button"
            className="h-7 rounded-full border bg-panel px-3 text-xs text-muted-foreground hover:border-border-strong hover:text-foreground"
            onClick={() => {
              setText(example.text);
              setTypeId(example.typeId);
            }}
          >
            {example.text}
          </button>
        ))}
      </div>
    </>
  );
}
