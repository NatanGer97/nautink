import { useEffect, useSyncExternalStore } from 'react';

import { commandRegistry } from './command-registry.ts';

import type { AppCommand, CommandRegistry } from './command-registry.ts';

/** Every registered command, re-rendering when the set changes. */
export function useCommands(registry: CommandRegistry = commandRegistry): readonly AppCommand[] {
  return useSyncExternalStore(registry.subscribe, registry.getCommands);
}

/**
 * Registers `commands` while the calling component is mounted. Pass a memoized array: a new
 * array re-registers on every render.
 */
export function useRegisterCommands(
  commands: readonly AppCommand[],
  registry: CommandRegistry = commandRegistry,
): void {
  useEffect(() => registry.register(commands), [commands, registry]);
}
