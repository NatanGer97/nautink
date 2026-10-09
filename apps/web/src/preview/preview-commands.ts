import { useMemo } from 'react';

import { useFocusModeStore } from './focus-mode.ts';
import { ZOOM_STEP } from './view-math.ts';
import { useRegisterCommands } from '../commands/use-commands.ts';

import type { ViewController } from './view-controller.ts';
import type { AppCommand } from '../commands/command-registry.ts';

function zoomCommand(controller: ViewController, direction: 'in' | 'out'): AppCommand {
  return {
    id: `preview.zoom-${direction}`,
    group: 'View',
    title: `Zoom ${direction}`,
    run: (): void => {
      controller.zoomBy(direction === 'in' ? ZOOM_STEP : 1 / ZOOM_STEP);
    },
  };
}

const FOCUS_MODE_COMMAND: AppCommand = {
  id: 'preview.focus-mode',
  group: 'View',
  title: 'Toggle focus mode',
  keywords: ['fullscreen', 'hide panels'],
  run: (): void => {
    useFocusModeStore.getState().toggleFocusMode();
  },
};

/** The preview's ⌘K commands: fit, zoom and focus mode. */
export function buildPreviewCommands(controller: ViewController): AppCommand[] {
  return [
    {
      id: 'preview.fit',
      group: 'View',
      title: 'Fit the diagram to the view',
      keywords: ['zoom', 'reset'],
      run: controller.fit,
    },
    zoomCommand(controller, 'in'),
    zoomCommand(controller, 'out'),
    FOCUS_MODE_COMMAND,
  ];
}

/** Registers the preview's commands while the canvas is mounted. */
export function usePreviewCommands(controller: ViewController): void {
  const commands: AppCommand[] = useMemo(() => buildPreviewCommands(controller), [controller]);
  useRegisterCommands(commands);
}
