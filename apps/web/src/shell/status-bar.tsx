import { typeName } from '@nautink/storage/diagram-type';
import { cn } from '@nautink/ui/lib/utils';

import { useVersionCount, versionCountLabel } from '../history/versions-store.ts';
import { useViewedVersion } from '../history/viewed-version.ts';
import { usePreviewStatus } from '../preview/preview-status.ts';
import { useChosenModelLabel } from '../settings/models.ts';
import { SaveStatus } from '../workspace/diagram-title.tsx';
import { lineCount } from '../workspace/text.ts';
import { useActiveDiagram } from '../workspace/use-workspace.ts';

import type { PreviewStatus, PreviewValidity } from '../preview/preview-status.ts';
import type { Diagram, Version } from '@nautink/storage/records';
import type { ReactElement } from 'react';

const VALIDITY_LABELS: Readonly<Record<PreviewValidity, string>> = {
  valid: 'Valid',
  invalid: 'Invalid',
  empty: 'Empty',
};

const VALIDITY_DOT_CLASS: Readonly<Record<PreviewValidity, string>> = {
  valid: 'bg-success',
  invalid: 'bg-destructive',
  empty: 'bg-faint',
};

function lineLabel(count: number): string {
  return count === 1 ? '1 line' : `${String(count)} lines`;
}

function renderLabel(renderMs: number | null): string {
  return renderMs === null ? 'Not rendered yet' : `Rendered in ${String(renderMs)} ms`;
}

/** The 28 px footer: type, validity, save state, lines, versions, render time, model (M1, M5). */
export function StatusBar(): ReactElement {
  const preview: PreviewStatus = usePreviewStatus();
  const modelName: string = useChosenModelLabel();
  const diagram: Diagram | undefined = useActiveDiagram();
  const viewed: Version | null = useViewedVersion();
  const versionCount: number | null = useVersionCount();
  const code: string = viewed?.code ?? diagram?.code ?? '';
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t bg-panel px-3.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{typeName(code)}</span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn('size-1.5 rounded-full', VALIDITY_DOT_CLASS[preview.validity])}
        />
        {VALIDITY_LABELS[preview.validity]}
      </span>
      {viewed === null ? (
        <SaveStatus className="max-sm:hidden" />
      ) : (
        <span className="max-sm:hidden">Viewing an older version · read-only</span>
      )}
      <span className="flex-1" />
      <span>{lineLabel(lineCount(code))}</span>
      {versionCount === null ? null : (
        <span className="max-sm:hidden">{versionCountLabel(versionCount)}</span>
      )}
      <span className="max-sm:hidden">{renderLabel(preview.renderMs)}</span>
      <span className="max-md:hidden">{modelName}</span>
    </footer>
  );
}
