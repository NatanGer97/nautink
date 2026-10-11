import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@nautink/ui/components/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { useRef } from 'react';

import { useWorkspaceStore } from '../use-workspace.ts';

import type { WorkspaceState } from '../store/workspace-state.ts';
import type { Diagram } from '@nautink/storage/records';
import type { ReactElement, RefObject } from 'react';

export interface DiagramRowMenuProps {
  diagram: Diagram;
  title: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Where focus goes when the menu closes (the list). */
  onCloseFocus: () => void;
}

/** The menu's items. Rename waits for the menu to close (`onRename`), so focus can move. */
function RowMenuItems({
  diagram,
  onRename,
}: {
  diagram: Diagram;
  onRename: () => void;
}): ReactElement {
  const actions: WorkspaceState = useWorkspaceStore.getState();
  const { id } = diagram;
  return (
    <>
      <DropdownMenuItem onSelect={onRename}>
        Rename
        <DropdownMenuShortcut className="font-mono tracking-normal">F2</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void actions.duplicateDiagram(id)}>
        Duplicate
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          actions.togglePin(id);
        }}
      >
        {diagram.pinned ? 'Unpin' : 'Pin to top'}
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          actions.downloadDiagram(id);
        }}
      >
        Download .mmd
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onSelect={() => void actions.deleteDiagram(id)}>
        Delete
      </DropdownMenuItem>
    </>
  );
}

/** The row's ⋯ menu: rename, duplicate, pin, download and delete (M3). */
export function DiagramRowMenu({
  diagram,
  title,
  isOpen,
  onOpenChange,
  onCloseFocus,
}: DiagramRowMenuProps): ReactElement {
  // The rename field takes focus, which the open menu would pull back; so it starts on close.
  const isRenamePendingRef: RefObject<boolean> = useRef<boolean>(false);
  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
      {/* A pointer shortcut only. A row is a listbox option, which must not hold a focusable
          control (WCAG 4.1.2), so the button is hidden from assistive tech and the keyboard: the
          list opens the same menu with Shift+F10 or the menu key. */}
      <DropdownMenuTrigger asChild>
        <span
          role="button"
          aria-hidden="true"
          aria-label={`Actions for ${title}`}
          className="grid size-6 shrink-0 place-items-center rounded-control text-muted-foreground opacity-0 group-hover/row:opacity-100 group-data-[cursor=true]/row:opacity-100 hover:bg-panel hover:text-foreground aria-expanded:opacity-100 [&_svg]:size-4"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <MoreHorizontal aria-hidden="true" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-card p-1 shadow-menu"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (isRenamePendingRef.current) {
            isRenamePendingRef.current = false;
            useWorkspaceStore.getState().startRename(diagram.id);
            return;
          }
          onCloseFocus();
        }}
      >
        <RowMenuItems
          diagram={diagram}
          onRename={() => {
            isRenamePendingRef.current = true;
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
