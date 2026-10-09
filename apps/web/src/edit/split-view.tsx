import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@nautink/ui/components/resizable';
import { Eye, PencilRuler } from 'lucide-react';

import { EditCanvasLoader } from './edit-canvas-loader.tsx';
import { selectedIdsOf, useCanvasSelection } from './selection/canvas-selection.ts';
import { mirrorShapeClick } from './split-mirror.ts';
import { PreviewCanvas } from '../preview/preview-canvas.tsx';
import { useActiveDiagram } from '../workspace/use-workspace.ts';

import type { CanvasSelection } from './selection/canvas-selection.ts';
import type { Diagram } from '@nautink/storage/records';
import type { ReactElement, ReactNode } from 'react';

interface HalfProps {
  label: string;
  hint: string;
  icon: ReactNode;
  children: ReactNode;
}

/** One half of Split: a 36 px header (M4) over its canvas. */
function SplitHalf({ label, hint, icon, children }: HalfProps): ReactElement {
  return (
    <section aria-label={label} className="flex h-full min-w-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b bg-panel px-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground [&_svg]:size-4">
          {icon}
          {label}
        </span>
        <span className="truncate max-md:hidden">{hint}</span>
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </section>
  );
}

/** The preview half: shows the editor's selection, and a click selects in the editor too. */
function MirroredPreview(): ReactElement {
  const diagram: Diagram | undefined = useActiveDiagram();
  const selection: CanvasSelection = useCanvasSelection();
  if (diagram === undefined) {
    return <PreviewCanvas />;
  }
  return (
    <PreviewCanvas
      selectedIds={selectedIdsOf(selection, diagram.id)}
      onShapeClick={(target: Element) => {
        mirrorShapeClick(diagram.id, diagram.code, target);
      }}
    />
  );
}

/** Split (PRD §4.4, M4): the visual editor beside the real Mermaid render, with a draggable divider. */
export function SplitView(): ReactElement {
  return (
    <ResizablePanelGroup orientation="horizontal" className="absolute inset-0">
      <ResizablePanel id="split-edit" defaultSize="50%" minSize={280}>
        <SplitHalf
          label="Visual editor"
          hint="Drag, connect and rename on this side"
          icon={<PencilRuler aria-hidden="true" />}
        >
          <EditCanvasLoader isSplit />
        </SplitHalf>
      </ResizablePanel>
      <ResizableHandle aria-label="Resize split" />
      <ResizablePanel id="split-preview" defaultSize="50%" minSize={280}>
        <SplitHalf
          label="Mermaid render"
          hint="Exactly what GitHub and docs will show"
          icon={<Eye aria-hidden="true" />}
        >
          <MirroredPreview />
        </SplitHalf>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
