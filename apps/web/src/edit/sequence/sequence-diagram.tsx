// The sequence drawing: one SVG laid out from the model (v1's `Canvas`), with the drag previews.
import { BlockFrames } from './sequence-blocks.tsx';
import {
  ActivationBars,
  BoxFrames,
  DiagramTitle,
  Lifelines,
  RectBackgrounds,
} from './sequence-frames.tsx';
import { selfPath } from './sequence-geometry.ts';
import { Headers } from './sequence-headers.tsx';
import { previewMarker, SequenceMarkers } from './sequence-markers.tsx';
import { Rows } from './sequence-rows.tsx';
import { svg } from './svg-path.ts';

import type { DragPreview } from './sequence-drag.ts';
import type { CanvasHandlers, CanvasScene } from './sequence-scene.ts';
import type { SequenceLayout } from '@nautink/editors/sequence/layout';
import type { ReactElement } from 'react';

const TARGET_R: number = 5;
const DROP_INSET: number = 6;
const PREVIEW: string = 'fill-none stroke-accent-ink [stroke-width:2] [stroke-dasharray:5_3]';
const DROP_LINE: string =
  'pointer-events-none stroke-accent-ink [stroke-width:2.5] [stroke-linecap:round]';

function LinkPreview({
  preview,
  layout,
  markerId,
}: {
  preview: Extract<DragPreview, { mode: 'link' }>;
  layout: SequenceLayout;
  markerId: string;
}): ReactElement {
  const target: number | undefined = layout.cols.find((col) => col.id === preview.target)?.x;
  const isSelf: boolean = preview.target === preview.from;
  const path: string = isSelf
    ? selfPath(preview.x0, preview.y0)
    : svg`M${preview.x0},${preview.y0} H${target ?? preview.x}`;
  return (
    <g>
      <path className={PREVIEW} d={path} markerEnd={previewMarker(markerId)} />
      {target === undefined ? null : (
        <circle className="fill-accent-ink" cx={target} cy={preview.y0} r={TARGET_R} />
      )}
    </g>
  );
}

/** What a drag shows: the message being drawn, or where rows or a column will land. */
function DragPreviewLayer({ scene }: { scene: CanvasScene }): ReactElement | null {
  const { preview, layout } = scene;
  switch (preview?.mode) {
    case 'link':
      return <LinkPreview preview={preview} layout={layout} markerId={scene.markerId} />;
    case 'item':
      return preview.slot === null ? null : (
        <line
          className={DROP_LINE}
          x1={layout.minX + DROP_INSET}
          x2={layout.width - DROP_INSET}
          y1={preview.slot.y}
          y2={preview.slot.y}
        />
      );
    case 'col':
      return (
        <line className={DROP_LINE} x1={preview.x} x2={preview.x} y1={layout.top} y2={layout.end} />
      );
    default:
      return null;
  }
}

/** The whole drawing, sized to the layout; the stage around it pans and zooms. */
export function SequenceDiagram({
  scene,
  handlers,
}: {
  scene: CanvasScene;
  handlers: CanvasHandlers;
}): ReactElement {
  const { layout } = scene;
  const width: number = layout.width - layout.minX;
  return (
    <svg
      role="group"
      aria-label="Sequence diagram"
      width={width}
      height={layout.height}
      viewBox={`${String(layout.minX)} 0 ${String(width)} ${String(layout.height)}`}
      className="block overflow-visible text-[13px] select-none [font-family:system-ui,sans-serif]"
    >
      <SequenceMarkers prefix={scene.markerId} />
      <DiagramTitle scene={scene} />
      <BoxFrames scene={scene} handlers={handlers} />
      <RectBackgrounds scene={scene} />
      <Lifelines scene={scene} handlers={handlers} />
      <ActivationBars scene={scene} />
      <BlockFrames scene={scene} handlers={handlers} />
      <Rows scene={scene} handlers={handlers} />
      <Headers scene={scene} handlers={handlers} />
      <DragPreviewLayer scene={scene} />
    </svg>
  );
}
