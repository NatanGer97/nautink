import { useDiagramRender } from './use-diagram-render.ts';
import { useViewedVersion } from '../history/viewed-version.ts';
import { useIsDarkTheme } from '../lib/use-is-dark-theme.ts';
import { useActiveDiagram } from '../workspace/use-workspace.ts';

import type { Diagram, Version } from '@nautink/storage/records';

/** The preview status id of what the canvas shows: the diagram, or `version:<id>` for a viewed version. */
export function renderIdOf(diagramId: string, viewed: Version | null): string {
  return viewed === null ? diagramId : `version:${viewed.id}`;
}

/**
 * Keeps the preview status (validity, render time, the SVG export uses) current while no preview is
 * on screen, as in Edit mode. Renders nothing.
 */
export function BackgroundRender(): null {
  const diagram: Diagram | undefined = useActiveDiagram();
  const viewed: Version | null = useViewedVersion();
  const isDark: boolean = useIsDarkTheme();
  useDiagramRender({
    diagramId: renderIdOf(diagram?.id ?? '', viewed),
    code: viewed?.code ?? diagram?.code ?? '',
    isDark,
  });
  return null;
}
