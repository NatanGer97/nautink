import { useMemo } from 'react';

import { viewAvailability } from './canvas-views.ts';
import { buildViewCommands } from './view-commands.ts';
import { useRegisterCommands } from '../commands/use-commands.ts';
import { selectActiveDiagram, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { AppCommand } from '../commands/command-registry.ts';
import type { WorkspaceData } from '../workspace/workspace-state.ts';

function selectCanEdit(state: WorkspaceData): boolean {
  return viewAvailability(selectActiveDiagram(state)?.code ?? '').reason === null;
}

/** Registers the Preview / Edit / Split commands, disabling Edit and Split for code-only types. */
export function useViewCommands(): void {
  const canEdit: boolean = useWorkspaceStore(selectCanEdit);
  const commands: AppCommand[] = useMemo(
    () => buildViewCommands(useWorkspaceStore.getState, canEdit),
    [canEdit],
  );
  useRegisterCommands(commands);
}
