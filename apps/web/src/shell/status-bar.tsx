import { MODEL_LABELS } from '@nautink/contracts/models';
import { cn } from '@nautink/ui/lib/utils';

import { useUiStore } from '../state/ui-store.ts';

import type { ModelId } from '@nautink/contracts/models';
import type { ReactElement } from 'react';

/** What the status bar reports about the open diagram. */
export interface DiagramStatus {
  typeLabel: string;
  isValid: boolean;
  saveState: string;
  lineCount: number;
  /** `null` until the first render. */
  renderMs: number | null;
}

/** Shown until the editor and renderer report real values. */
export const PLACEHOLDER_STATUS: DiagramStatus = {
  typeLabel: 'Flowchart',
  isValid: true,
  saveState: 'Saved',
  lineCount: 0,
  renderMs: null,
};

export interface StatusBarProps {
  status?: DiagramStatus;
}

function renderLabel(renderMs: number | null): string {
  return renderMs === null ? 'Not rendered yet' : `Rendered in ${String(renderMs)} ms`;
}

/** The 28 px footer: type, validity, save state, line count, render time, model (M1). */
export function StatusBar({ status = PLACEHOLDER_STATUS }: StatusBarProps): ReactElement {
  const model: ModelId | null = useUiStore((state) => state.defaultModel);
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t bg-panel px-3.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{status.typeLabel}</span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn('size-1.5 rounded-full', status.isValid ? 'bg-success' : 'bg-destructive')}
        />
        {status.isValid ? 'Valid' : 'Invalid'}
      </span>
      <span className="max-sm:hidden">{status.saveState}</span>
      <span className="flex-1" />
      <span>{`${String(status.lineCount)} lines`}</span>
      <span className="max-sm:hidden">{renderLabel(status.renderMs)}</span>
      <span className="max-md:hidden">
        {model === null ? 'Default model' : MODEL_LABELS[model]}
      </span>
    </footer>
  );
}
