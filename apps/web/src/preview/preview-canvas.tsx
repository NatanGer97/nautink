import { Button } from '@nautink/ui/components/button';

import { useFocusModeEscape } from './focus-mode.ts';
import { ParseErrorNotice, parseErrorAnnouncement } from './parse-error-notice.tsx';
import { usePreviewCommands } from './preview-commands.ts';
import { usePreviewStatus } from './preview-status.ts';
import { useDiagramRender } from './use-diagram-render.ts';
import { STAGE_ATTRIBUTE, usePanZoom } from './use-pan-zoom.ts';
import { viewTransformCss } from './view-math.ts';
import { ZoomControls } from './zoom-controls.tsx';
import { useIsDarkTheme } from '../lib/use-is-dark-theme.ts';
import { useUiStore } from '../state/ui-store.ts';
import { useActiveDiagram } from '../workspace/use-workspace.ts';

import type { PreviewStatus } from './preview-status.ts';
import type { PanZoom, PanZoomOptions, PointerHandlers } from './use-pan-zoom.ts';
import type { ViewController } from './view-controller.ts';
import type { ViewTransform } from './view-math.ts';
import type { Diagram } from '@nautink/storage/records';
import type { ReactElement } from 'react';

export interface PreviewCanvasProps {
  /** A click (not a drag) on something inside the rendered diagram. */
  onShapeClick?: (target: Element) => void;
}

interface PreviewSurfaceProps extends PreviewCanvasProps {
  diagramId: string;
  code: string;
}

/** Shown while the diagram has no code: an invitation to start one. */
function EmptyPreview(): ReactElement {
  const setCodeDrawerOpen: (isOpen: boolean) => void = useUiStore(
    (state) => state.setCodeDrawerOpen,
  );
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div className="flex max-w-72 flex-col items-center gap-3">
        <p className="text-muted-foreground">
          Describe a diagram in chat, or write Mermaid in the code drawer.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCodeDrawerOpen(true);
          }}
        >
          Open code
        </Button>
      </div>
    </div>
  );
}

interface StageProps {
  viewportRef: PanZoom['viewportRef'];
  stageRef: PanZoom['stageRef'];
  view: ViewTransform;
  controller: ViewController;
  handlers: PointerHandlers;
  svg: string;
}

/** The pan surface and the rendered SVG, placed by the current view. */
function Stage({
  viewportRef,
  stageRef,
  view,
  controller,
  handlers,
  svg,
}: StageProps): ReactElement {
  return (
    <div
      ref={viewportRef}
      role="group"
      aria-label="Diagram preview"
      className="absolute inset-0 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
      onDoubleClick={controller.fit}
      {...handlers}
    >
      <div
        ref={stageRef}
        {...{ [STAGE_ATTRIBUTE]: '' }}
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: viewTransformCss(view) }}
        // Mermaid's own output, sanitized by Mermaid under `securityLevel: 'strict'`.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

function PreviewSurface({ diagramId, code, onShapeClick }: PreviewSurfaceProps): ReactElement {
  const isDark: boolean = useIsDarkTheme();
  useDiagramRender({ diagramId, code, isDark });
  const status: PreviewStatus = usePreviewStatus();
  const isCurrent: boolean = status.diagramId === diagramId;
  const svg: string = isCurrent ? status.svg : '';
  const clickOption: Pick<PanZoomOptions, 'onShapeClick'> = onShapeClick ? { onShapeClick } : {};
  const { viewportRef, stageRef, view, controller, handlers } = usePanZoom({
    svg,
    fitKey: diagramId,
    ...clickOption,
  });
  usePreviewCommands(controller);
  useFocusModeEscape();
  const error: PreviewStatus['error'] = isCurrent ? status.error : null;
  return (
    <div className="absolute inset-0">
      {code.trim() === '' ? (
        <EmptyPreview />
      ) : (
        <Stage {...{ viewportRef, stageRef, view, controller, handlers, svg }} />
      )}
      {error === null ? null : <ParseErrorNotice error={error} hasLastRender={svg !== ''} />}
      <p className="sr-only" aria-live="polite">
        {parseErrorAnnouncement(error)}
      </p>
      <ZoomControls controller={controller} zoom={view.k} />
    </div>
  );
}

/** The canvas in Preview mode: the open diagram rendered by Mermaid, with pan, zoom and fit. */
export function PreviewCanvas({ onShapeClick }: PreviewCanvasProps): ReactElement {
  const diagram: Diagram | undefined = useActiveDiagram();
  if (diagram === undefined) {
    return (
      <div className="grid h-full place-items-center p-6 text-muted-foreground">
        Opening your diagrams…
      </div>
    );
  }
  return (
    <PreviewSurface
      diagramId={diagram.id}
      code={diagram.code}
      {...(onShapeClick ? { onShapeClick } : {})}
    />
  );
}
