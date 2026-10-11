import { CANVAS_VIEW_LABELS, CANVAS_VIEWS, viewAvailability } from './canvas-views.ts';
import { selectActiveDiagram } from '../workspace/use-workspace.ts';

import type { AppCommand } from '../commands/command-registry.ts';
import type { WorkspaceState } from '../workspace/store/workspace-state.ts';
import type { Diagram, DiagramView } from '@nautink/storage/records';

type GetWorkspace = () => WorkspaceState;

/** Sets the open diagram's view; Edit and Split only when its type has a visual editor. */
export function switchView(getState: GetWorkspace, view: DiagramView): void {
  const state: WorkspaceState = getState();
  const diagram: Diagram | undefined = selectActiveDiagram(state);
  if (diagram === undefined) {
    return;
  }
  if (view !== 'preview' && viewAvailability(diagram.code).reason !== null) {
    return;
  }
  state.setView(diagram.id, view);
}

/** "Switch to preview", "Switch to edit", "Switch to split" in ⌘K. */
export function buildViewCommands(getState: GetWorkspace, canEdit: boolean): AppCommand[] {
  return CANVAS_VIEWS.map((view) => ({
    id: `canvas.${view}`,
    group: 'View',
    title: `Switch to ${CANVAS_VIEW_LABELS[view].toLowerCase()}`,
    isDisabled: view !== 'preview' && !canEdit,
    run: (): void => {
      switchView(getState, view);
    },
  }));
}
