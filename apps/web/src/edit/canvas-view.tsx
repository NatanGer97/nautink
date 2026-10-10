import { shownView, viewAvailability } from './canvas-views.ts';
import { EditCanvasLoader } from './edit-canvas-loader.tsx';
import { SplitView } from './split-view.tsx';
import { useViewedVersion } from '../history/viewed-version.ts';
import { BackgroundRender } from '../preview/background-render.tsx';
import { PreviewCanvas } from '../preview/preview-canvas.tsx';
import { useShownCode } from '../review/use-review.ts';
import { useActiveDiagram } from '../workspace/use-workspace.ts';

import type { Diagram, DiagramView, Version } from '@nautink/storage/records';
import type { ReactElement } from 'react';

const NO_DIAGRAM: Pick<Diagram, 'id' | 'code'> = { id: '', code: '' };

function useShownView(): DiagramView {
  const diagram: Diagram | undefined = useActiveDiagram();
  const viewed: Version | null = useViewedVersion();
  const shown: string = useShownCode(diagram ?? NO_DIAGRAM);
  const code: string = viewed?.code ?? shown;
  return shownView(diagram?.view ?? 'preview', viewAvailability(code));
}

/** The canvas for the open diagram's view: Preview, Edit, or both side by side (PRD §3.3, §4.4). */
export function CanvasView(): ReactElement {
  const view: DiagramView = useShownView();
  if (view === 'edit') {
    return (
      <>
        <BackgroundRender />
        <EditCanvasLoader isSplit={false} />
      </>
    );
  }
  return view === 'split' ? <SplitView /> : <PreviewCanvas />;
}
