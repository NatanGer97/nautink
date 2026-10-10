import { Tooltip, TooltipContent, TooltipTrigger } from '@nautink/ui/components/tooltip';
import { X } from 'lucide-react';

import { removeSelectionChip, useSelectionChip } from './chat-selection.ts';
import { selectionSummary } from '../edit/selection/canvas-selection.ts';

import type { SelectedItem } from '../edit/selection/canvas-selection.ts';
import type { ReactElement } from 'react';

export interface SelectionChipProps {
  /** The open diagram; the chip shows only its selection. */
  diagramId: string | undefined;
}

/**
 * "2 nodes selected" in the composer and the prompt bar (M1, PRD §4.1): the message goes with the
 * canvas selection while it shows. × removes it, so the message applies to the whole diagram.
 */
export function SelectionChip({ diagramId }: SelectionChipProps): ReactElement | null {
  const items: readonly SelectedItem[] = useSelectionChip(diagramId);
  if (items.length === 0) {
    return null;
  }
  const summary: string = selectionSummary(items);
  return (
    <span
      data-testid="selection-chip"
      className="inline-flex h-[22px] max-w-full min-w-0 shrink-0 items-center gap-0.5 rounded-control border border-accent-ink/25 bg-accent-wash pr-0.5 pl-2 text-xs text-accent-ink-strong"
    >
      <span className="truncate">{summary}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Remove “${summary}”`}
            className="grid size-[18px] shrink-0 place-items-center rounded-[4px] outline-none hover:bg-accent-ink/10 focus-visible:ring-2 focus-visible:ring-ring"
            onClick={removeSelectionChip}
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Ask about the whole diagram</TooltipContent>
      </Tooltip>
    </span>
  );
}
