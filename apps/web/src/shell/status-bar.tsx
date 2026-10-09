import { MODEL_LABELS } from '@nautink/contracts/models';
import { typeName } from '@nautink/storage/diagram-type';
import { cn } from '@nautink/ui/lib/utils';

import { useUiStore } from '../state/ui-store.ts';
import { SaveStatus } from '../workspace/diagram-title.tsx';
import { lineCount } from '../workspace/text.ts';
import { useActiveDiagram } from '../workspace/use-workspace.ts';

import type { ModelId } from '@nautink/contracts/models';
import type { Diagram } from '@nautink/storage/records';
import type { ReactElement } from 'react';

/** What the preview reports about the open diagram. A seam for the preview wave. */
export interface PreviewStatus {
  isValid: boolean;
  /** `null` until the first render. */
  renderMs: number | null;
}

/** Shown until the renderer reports real values. */
export const PLACEHOLDER_PREVIEW_STATUS: PreviewStatus = {
  isValid: true,
  renderMs: null,
};

export interface StatusBarProps {
  preview?: PreviewStatus;
}

function lineLabel(count: number): string {
  return count === 1 ? '1 line' : `${String(count)} lines`;
}

function renderLabel(renderMs: number | null): string {
  return renderMs === null ? 'Not rendered yet' : `Rendered in ${String(renderMs)} ms`;
}

/** The 28 px footer: type, validity, save state, line count, render time, model (M1). */
export function StatusBar({ preview = PLACEHOLDER_PREVIEW_STATUS }: StatusBarProps): ReactElement {
  const model: ModelId | null = useUiStore((state) => state.defaultModel);
  const diagram: Diagram | undefined = useActiveDiagram();
  const code: string = diagram?.code ?? '';
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t bg-panel px-3.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{typeName(code)}</span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn('size-1.5 rounded-full', preview.isValid ? 'bg-success' : 'bg-destructive')}
        />
        {preview.isValid ? 'Valid' : 'Invalid'}
      </span>
      <SaveStatus className="max-sm:hidden" />
      <span className="flex-1" />
      <span>{lineLabel(lineCount(code))}</span>
      <span className="max-sm:hidden">{renderLabel(preview.renderMs)}</span>
      <span className="max-md:hidden">
        {model === null ? 'Default model' : MODEL_LABELS[model]}
      </span>
    </footer>
  );
}
