import { SHORTCUTS, shortcutLabel } from '../../lib/shortcuts.ts';

import type { AppCommand } from '../../commands/command-registry.ts';
import type { WorkspaceState } from '../store/workspace-state.ts';

type GetWorkspace = () => WorkspaceState;

/** What the palette needs to know to enable the edit commands. */
export interface EditCommandState {
  canUndo: boolean;
  canRedo: boolean;
}

function historyCommand(
  getState: GetWorkspace,
  action: 'undo' | 'redo',
  isEnabled: boolean,
): AppCommand {
  return {
    id: `edit.${action}`,
    group: 'Edit',
    title: action === 'undo' ? 'Undo' : 'Redo',
    shortcut: shortcutLabel(SHORTCUTS[action]),
    isDisabled: !isEnabled,
    run: (): void => {
      getState()[action]();
    },
  };
}

/** Undo and redo in the ⌘K palette, disabled when there is no step to move to. */
export function buildEditCommands(getState: GetWorkspace, state: EditCommandState): AppCommand[] {
  return [
    historyCommand(getState, 'undo', state.canUndo),
    historyCommand(getState, 'redo', state.canRedo),
  ];
}
