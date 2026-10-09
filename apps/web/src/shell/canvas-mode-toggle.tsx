import { ToggleGroup, ToggleGroupItem } from '@nautink/ui/components/toggle-group';

import { CANVAS_MODE_LABELS } from '../commands/shell-commands.ts';
import { CANVAS_MODES } from '../state/ui-prefs.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { CanvasMode } from '../state/ui-prefs.ts';
import type { ReactElement } from 'react';

function isCanvasMode(value: string): value is CanvasMode {
  return (CANVAS_MODES as readonly string[]).includes(value);
}

/** Preview, Edit and Split as a segmented control. State only until the canvas lands. */
export function CanvasModeToggle(): ReactElement {
  const canvasMode: CanvasMode = useUiStore((state) => state.canvasMode);
  const setCanvasMode: (mode: CanvasMode) => void = useUiStore((state) => state.setCanvasMode);
  return (
    <ToggleGroup
      type="single"
      spacing={0.5}
      value={canvasMode}
      onValueChange={(value: string) => {
        if (isCanvasMode(value)) {
          setCanvasMode(value);
        }
      }}
      aria-label="Canvas mode"
      className="rounded-track bg-muted p-[3px]"
    >
      {CANVAS_MODES.map((mode) => (
        <ToggleGroupItem
          key={mode}
          value={mode}
          className="h-[26px] rounded-control px-3 text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-panel data-[state=on]:text-foreground data-[state=on]:shadow-segment"
        >
          {CANVAS_MODE_LABELS[mode]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
