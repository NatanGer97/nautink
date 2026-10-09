import { useMemo } from 'react';

import { selectActiveStack, useWorkspaceStore } from './use-workspace.ts';
import { buildEditCommands } from './workspace-commands.ts';
import { useRegisterCommands } from '../commands/use-commands.ts';

import type { EditStack } from './edit-history.ts';
import type { AppCommand } from '../commands/command-registry.ts';

/** Registers the workspace's ⌘K commands, re-registering when what they can do changes. */
export function useWorkspaceCommands(): void {
  const canUndo: boolean = useWorkspaceStore((state) => {
    const stack: EditStack | undefined = selectActiveStack(state);
    return stack !== undefined && stack.index > 0;
  });
  const canRedo: boolean = useWorkspaceStore((state) => {
    const stack: EditStack | undefined = selectActiveStack(state);
    return stack !== undefined && stack.index < stack.entries.length - 1;
  });
  const commands: AppCommand[] = useMemo(
    () => buildEditCommands(useWorkspaceStore.getState, { canUndo, canRedo }),
    [canUndo, canRedo],
  );
  useRegisterCommands(commands);
}
