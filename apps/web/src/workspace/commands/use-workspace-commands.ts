import { sortDiagrams } from '@nautink/storage/diagram-order';
import { useMemo } from 'react';

import { buildDiagramCommands, OPEN_COMMAND_LIMIT } from './diagram-commands.ts';
import { useHistoryOverride } from '../undo/history-guard.ts';
import { selectActiveDiagram, selectActiveStack, useWorkspaceStore } from '../use-workspace.ts';
import { buildEditCommands } from './workspace-commands.ts';
import { useRegisterCommands } from '../../commands/use-commands.ts';
import { useUiStore } from '../../state/ui-store.ts';

import type { DiagramCommandState } from './diagram-commands.ts';
import type { AppCommand } from '../../commands/command-registry.ts';
import type { WorkspaceData } from '../store/workspace-state.ts';
import type { EditStack } from '../undo/edit-history.ts';

type RecentDiagrams = DiagramCommandState['recent'];

/** The recent other diagrams as a string, so the selector result only changes when they do. */
function selectRecentKey(state: WorkspaceData): string {
  const recent: RecentDiagrams = sortDiagrams(state.diagrams)
    .filter((diagram) => diagram.id !== state.activeId)
    .slice(0, OPEN_COMMAND_LIMIT)
    .map(({ id, title }) => ({ id, title }));
  return JSON.stringify(recent);
}

function selectCanUndo(state: WorkspaceData): boolean {
  const stack: EditStack | undefined = selectActiveStack(state);
  return stack !== undefined && stack.index > 0;
}

function selectCanRedo(state: WorkspaceData): boolean {
  const stack: EditStack | undefined = selectActiveStack(state);
  return stack !== undefined && stack.index < stack.entries.length - 1;
}

/** Registers the workspace's ⌘K commands, re-registering when what they can do changes. */
export function useWorkspaceCommands(): void {
  const isHeld: boolean = useHistoryOverride(useWorkspaceStore((state) => state.activeId)) !== null;
  const canUndo: boolean = useWorkspaceStore(selectCanUndo) || isHeld;
  const canRedo: boolean = useWorkspaceStore(selectCanRedo) && !isHeld;
  const isPinned: boolean = useWorkspaceStore(
    (state) => selectActiveDiagram(state)?.pinned === true,
  );
  const recentKey: string = useWorkspaceStore(selectRecentKey);
  const commands: AppCommand[] = useMemo(() => {
    const recent: RecentDiagrams = JSON.parse(recentKey) as RecentDiagrams;
    return [
      ...buildDiagramCommands(
        { getState: useWorkspaceStore.getState, getUi: useUiStore.getState },
        { isPinned, recent },
      ),
      ...buildEditCommands(useWorkspaceStore.getState, { canUndo, canRedo }),
    ];
  }, [canUndo, canRedo, isPinned, recentKey]);
  useRegisterCommands(commands);
}
