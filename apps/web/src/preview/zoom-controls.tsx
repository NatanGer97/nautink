import { IconButton } from '@nautink/ui/icon-button';
import { Maximize2, Minimize2, Minus, Plus, Scan } from 'lucide-react';

import { useFocusModeStore } from './focus-mode.ts';
import { ZOOM_STEP, zoomLabel } from './view-math.ts';

import type { ViewController } from './view-controller.ts';
import type { ReactElement } from 'react';

export interface ZoomControlsProps {
  controller: ViewController;
  zoom: number;
}

/** The floating zoom bar in the canvas's bottom-right corner (M1). */
export function ZoomControls({ controller, zoom }: ZoomControlsProps): ReactElement {
  const isFocusMode: boolean = useFocusModeStore((state) => state.isFocusMode);
  const toggleFocusMode: () => void = useFocusModeStore((state) => state.toggleFocusMode);
  return (
    <div
      role="toolbar"
      aria-label="Zoom"
      className="absolute right-4 bottom-4 flex items-center gap-0.5 rounded-card border bg-panel p-1 shadow-float"
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
        shortcut="Double-click"
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
