import { IconButton } from '@nautink/ui/icon-button';
import { Maximize2, Minimize2, Minus, Plus, Scan } from 'lucide-react';

import { useFocusModeStore } from './focus-mode.ts';
import { ZOOM_STEP, zoomLabel } from './view-math.ts';

import type { ReactElement } from 'react';

/** What the zoom bar drives: the preview's `ViewController`, or a visual editor's canvas. */
export interface ZoomTarget {
  zoomBy: (factor: number) => void;
  fit: () => void;
}

export interface ZoomControlsProps {
  controller: ZoomTarget;
  zoom: number;
  /** The gesture that also fits, shown in the Fit tooltip. */
  fitShortcut?: string;
}

/** The floating zoom bar in the canvas's bottom-right corner (M1). */
export function ZoomControls({
  controller,
  zoom,
  fitShortcut = 'Double-click',
}: ZoomControlsProps): ReactElement {
  const isFocusMode: boolean = useFocusModeStore((state) => state.isFocusMode);
  const toggleFocusMode: () => void = useFocusModeStore((state) => state.toggleFocusMode);
  return (
    <div
      role="toolbar"
      aria-label="Zoom"
      data-canvas-chrome=""
      className="absolute right-4 bottom-4 flex items-center gap-0.5 rounded-card border bg-panel p-1 shadow-float @max-[52rem]:bottom-[72px]"
    >
      <IconButton
        label="Zoom out"
        icon={<Minus />}
        tooltipSide="top"
        className="size-7"
        onClick={() => {
          controller.zoomBy(1 / ZOOM_STEP);
        }}
      />
      <span
        aria-live="off"
        className="w-11 text-center font-mono text-xs font-medium text-muted-foreground tabular-nums"
      >
        {zoomLabel(zoom)}
      </span>
      <IconButton
        label="Zoom in"
        icon={<Plus />}
        tooltipSide="top"
        className="size-7"
        onClick={() => {
          controller.zoomBy(ZOOM_STEP);
        }}
      />
      <IconButton
        label="Fit to view"
        shortcut={fitShortcut}
        icon={<Scan />}
        tooltipSide="top"
        className="size-7"
        onClick={controller.fit}
      />
      <IconButton
        label={isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}
        {...(isFocusMode ? { shortcut: 'Esc' } : {})}
        icon={isFocusMode ? <Minimize2 /> : <Maximize2 />}
        tooltipSide="top"
        className="size-7"
        isActive={isFocusMode}
        aria-pressed={isFocusMode}
        onClick={toggleFocusMode}
      />
    </div>
  );
}
