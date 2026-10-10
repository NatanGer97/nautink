import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@nautink/ui/components/dropdown-menu';
import { ChevronDown } from 'lucide-react';

import { CHIP_CLASS } from './chip-button.tsx';
import { DEFAULT_MODEL_VALUE, modelLabel, toModel, useModelOptions } from '../settings/models.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { AgentId } from '@nautink/contracts/agents';
import type { ModelOption } from '@nautink/contracts/models';
import type { ReactElement } from 'react';

/** The chat header's model chip (M1). It sets the remembered default model, as v1's picker did. */
export function ModelChip(): ReactElement {
  const agent: AgentId = useUiStore((state) => state.agent);
  const model: string | null = useUiStore((state) => state.defaultModel);
  const setModel: (model: string | null) => void = useUiStore((state) => state.setDefaultModel);
  const options: readonly ModelOption[] = useModelOptions(agent);
  const label: string = modelLabel(model, options);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Model: ${label}`}
        className={`${CHIP_CLASS} text-foreground`}
      >
        {label}
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup
          value={model ?? DEFAULT_MODEL_VALUE}
          onValueChange={(value: string) => {
            setModel(toModel(value, options));
          }}
        >
          <DropdownMenuRadioItem value={DEFAULT_MODEL_VALUE}>Default</DropdownMenuRadioItem>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
