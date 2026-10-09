import { ToggleGroup, ToggleGroupItem } from '@nautink/ui/components/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@nautink/ui/components/tooltip';

import {
  CANVAS_VIEW_LABELS,
  CANVAS_VIEWS,
  isDiagramView,
  viewAvailability,
} from '../edit/canvas-views.ts';
import { switchView } from '../edit/view-commands.ts';
import { useActiveDiagram, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { ViewAvailability } from '../edit/canvas-views.ts';
import type { Diagram, DiagramView } from '@nautink/storage/records';
import type { ReactElement } from 'react';

const ITEM_CLASS: string =
  'h-[26px] rounded-control px-3 text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-panel data-[state=on]:text-foreground data-[state=on]:shadow-segment aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:text-muted-foreground';

interface ViewItemProps {
  view: DiagramView;
  reason: string | null;
}

/** One segment. Unavailable segments stay focusable (aria-disabled) so the tooltip can explain why. */
function ViewItem({ view, reason }: ViewItemProps): ReactElement {
  const isUnavailable: boolean = view !== 'preview' && reason !== null;
  const item: ReactElement = (
    <ToggleGroupItem
      value={view}
      aria-disabled={isUnavailable ? true : undefined}
      className={ITEM_CLASS}
    >
      {CANVAS_VIEW_LABELS[view]}
    </ToggleGroupItem>
  );
  if (!isUnavailable) {
    return item;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{item}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}

/** Preview, Edit and Split for the open diagram (its saved `view`); M7 disables Edit and Split for code-only types. */
export function CanvasModeToggle(): ReactElement {
  const diagram: Diagram | undefined = useActiveDiagram();
  const availability: ViewAvailability = viewAvailability(diagram?.code ?? '');
  return (
    <ToggleGroup
      type="single"
      spacing={0.5}
      value={diagram?.view ?? 'preview'}
      onValueChange={(value: string) => {
        if (isDiagramView(value)) {
          switchView(useWorkspaceStore.getState, value);
        }
      }}
      aria-label="Canvas mode"
      className="rounded-track bg-muted p-[3px]"
    >
      {CANVAS_VIEWS.map((view) => (
        <ViewItem key={view} view={view} reason={availability.reason} />
      ))}
    </ToggleGroup>
  );
}
