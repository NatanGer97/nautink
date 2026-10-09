import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@nautink/ui/components/dropdown-menu';
import { ChevronDown } from 'lucide-react';

import { backUpAll, openFiles, pickAndRestoreBackup } from './import-files.ts';

import type { ReactElement } from 'react';

/** "Import or back up" in the diagrams panel footer: open files, back up all, restore a backup. */
export function ImportMenu({ isDisabled }: { isDisabled: boolean }): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isDisabled}
        className="inline-flex items-center gap-0.5 rounded-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        Import or back up
        <ChevronDown aria-hidden="true" className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-52">
        <DropdownMenuItem onSelect={() => void openFiles()}>Open file…</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void backUpAll()}>Back up all diagrams</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void pickAndRestoreBackup()}>
          Restore backup…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
