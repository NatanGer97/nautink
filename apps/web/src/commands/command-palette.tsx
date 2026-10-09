import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@nautink/ui/components/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@nautink/ui/components/dialog';
import { useRef } from 'react';

import { useCommands } from './use-commands.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { AppCommand } from './command-registry.ts';
import type { ReactElement, RefObject } from 'react';

/** Commands grouped by their `group`, in the order each group first appears. */
export function groupCommands(commands: readonly AppCommand[]): Map<string, AppCommand[]> {
  const groups: Map<string, AppCommand[]> = new Map<string, AppCommand[]>();
  for (const command of commands) {
    groups.set(command.group, [...(groups.get(command.group) ?? []), command]);
  }
  return groups;
}

interface PaletteRunner {
  runCommand: (command: AppCommand) => void;
  onOpenAutoFocus: () => void;
  onCloseAutoFocus: (event: Event) => void;
}

/** Runs commands from the palette, and deferred ones once it has closed. */
function usePaletteRunner(setOpen: (isOpen: boolean) => void): PaletteRunner {
  // A command may move focus (⌘/ focuses the composer); the dialog must not pull it back on close.
  const didRunRef: RefObject<boolean> = useRef<boolean>(false);
  const deferredRef: RefObject<AppCommand | null> = useRef<AppCommand>(null);
  return {
    runCommand: (command: AppCommand): void => {
      didRunRef.current = true;
      setOpen(false);
      if (command.isDeferred === true) {
        deferredRef.current = command;
        return;
      }
      command.run();
    },
    onOpenAutoFocus: (): void => {
      didRunRef.current = false;
    },
    onCloseAutoFocus: (event: Event): void => {
      if (didRunRef.current) {
        event.preventDefault();
      }
      deferredRef.current?.run();
      deferredRef.current = null;
    },
  };
}

/** The ⌘K palette: every registered command, searchable, grouped (PRD §3.6). */
export function CommandPalette(): ReactElement {
  const isOpen: boolean = useUiStore((state) => state.isPaletteOpen);
  const setOpen: (isOpen: boolean) => void = useUiStore((state) => state.setPaletteOpen);
  const commands: readonly AppCommand[] = useCommands();
  const { runCommand, onOpenAutoFocus, onCloseAutoFocus } = usePaletteRunner(setOpen);
  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] translate-y-0 gap-0 overflow-hidden rounded-dialog bg-panel p-0 shadow-dialog sm:max-w-[560px]"
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search for a command to run.</DialogDescription>
        <Command className="bg-panel">
          <CommandInput placeholder="Search or run a command…" className="h-11" />
          <CommandList className="max-h-[360px] p-1">
            <CommandEmpty>No matching commands.</CommandEmpty>
            {[...groupCommands(commands)].map(([group, items]) => (
              <CommandGroup key={group} heading={group}>
                {items.map((command) => (
                  <CommandItem
                    key={command.id}
                    value={command.title}
                    keywords={[command.group, ...(command.keywords ?? [])]}
                    disabled={command.isDisabled ?? false}
                    onSelect={() => {
                      runCommand(command);
                    }}
                  >
                    {command.title}
                    {command.shortcut === undefined ? null : (
                      <CommandShortcut className="font-mono tracking-normal">
                        {command.shortcut}
                      </CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
