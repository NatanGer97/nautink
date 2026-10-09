import { useReactFlow, useViewport } from '@xyflow/react';

import { useFitNow } from './use-canvas-fit.ts';
import { ZoomControls } from '../../preview/zoom-controls.tsx';

import type { ZoomTarget } from '../../preview/zoom-controls.tsx';
import type { ReactFlowInstance } from '@xyflow/react';
import type { ReactElement } from 'react';

const ZOOM_DURATION_MS: number = 150;

/** The canvas's zoom bar (bottom-right, as in Preview), driving React Flow. */
export function FlowZoomControls(): ReactElement {
  const flow: ReactFlowInstance = useReactFlow();
  const { zoom } = useViewport();
  const fitNow: (duration?: number) => void = useFitNow();
  const target: ZoomTarget = {
    zoomBy: (factor: number): void => {
      void flow.zoomTo(flow.getZoom() * factor, { duration: ZOOM_DURATION_MS });
    },
    fit: (): void => {
      fitNow();
    },
  };
  return <ZoomControls controller={target} zoom={zoom} fitShortcut="⇧1" />;
}
