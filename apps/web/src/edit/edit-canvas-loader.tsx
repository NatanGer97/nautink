import { Suspense, lazy } from 'react';

import { CenteredNotice } from './edit-notices.tsx';

import type { EditCanvasProps } from './edit-canvas.tsx';
import type { ComponentType, ReactElement } from 'react';

/** The Edit canvas and React Flow load on first use, so the main bundle stays small (PRD §9). */
const LazyEditCanvas: ComponentType<EditCanvasProps> = lazy(async () => ({
  default: (await import('./edit-canvas.tsx')).EditCanvas,
}));

/** The Edit canvas, with a calm placeholder while its chunk loads. */
export function EditCanvasLoader({ isSplit }: EditCanvasProps): ReactElement {
  return (
    <Suspense fallback={<CenteredNotice message="Loading the editor…">{null}</CenteredNotice>}>
      <LazyEditCanvas isSplit={isSplit} />
    </Suspense>
  );
}
