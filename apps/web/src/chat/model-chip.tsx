import { MODEL_IDS, MODEL_LABELS } from '@nautink/contracts/models';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@nautink/ui/components/dropdown-menu';
import { ChevronDown } from 'lucide-react';

import { CHIP_CLASS } from './chip-button.tsx';
import { useUiStore } from '../state/ui-store.ts';

import type { ModelId } from '@nautink/contracts/models';
import type { ReactElement } from 'react';

/** The radio value for Claude Code's own default model. */
const DEFAULT_VALUE: string = 'default';

/** "Default" or the model's name. */
export function modelLabel(model: ModelId | null): string {
  return model === null ? 'Default' : MODEL_LABELS[model];
}

function toModel(value: string): ModelId | null {
  const model: ModelId | undefined = MODEL_IDS.find((id) => id === value);
  if (model === undefined && value !== DEFAULT_VALUE) {
    throw new Error(`Unknown model "${value}".`);
  }
  return model ?? null;
}

/** The chat header's model chip (M1). It sets the remembered default model, as v1's picker did. */
export function ModelChip(): ReactElement {
  const model: ModelId | null = useUiStore((state) => state.defaultModel);
  const setModel: (model: ModelId | null) => void = useUiStore((state) => state.setDefaultModel);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Model: ${modelLabel(model)}`}
        className={`${CHIP_CLASS} text-foreground`}
      >
        {modelLabel(model)}
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup
          value={model ?? DEFAULT_VALUE}
          onValueChange={(value: string) => {
            setModel(toModel(value));
          }}
        >
          <DropdownMenuRadioItem value={DEFAULT_VALUE}>Default</DropdownMenuRadioItem>
          {MODEL_IDS.map((id) => (
            <DropdownMenuRadioItem key={id} value={id}>
              {MODEL_LABELS[id]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
