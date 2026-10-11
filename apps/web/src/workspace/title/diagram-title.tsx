import { cn } from '@nautink/ui/lib/utils';
import { useEffect, useState } from 'react';

import { InlineRenameInput } from './inline-rename-input.tsx';
import { SAVE_STATE_LABELS } from './save-state-label.ts';
import { displayTitle } from '../text.ts';
import { useActiveDiagram, useSaveState, useWorkspaceStore } from '../use-workspace.ts';

import type { SaveState } from '../store/autosave.ts';
import type { Diagram } from '@nautink/storage/records';
import type { ReactElement } from 'react';

/** Opens the rename field when ⌘K "Rename diagram" asks for it. */
function useTitleRenameRequest(isLoaded: boolean, setEditing: (isEditing: boolean) => void): void {
  const isRequested: boolean = useWorkspaceStore((state) => state.isTitleRenameRequested);
  useEffect(() => {
    if (isRequested && isLoaded) {
      setEditing(true);
      useWorkspaceStore.getState().takeTitleRenameRequest();
    }
  }, [isRequested, isLoaded, setEditing]);
}

/**
 * The open diagram's title in the top bar; click it (or run ⌘K "Rename diagram") to rename it in
 * place. Also names the browser tab.
 */
export function DiagramTitle(): ReactElement {
  const diagram: Diagram | undefined = useActiveDiagram();
  const renameDiagram: (id: string, title: string) => void = useWorkspaceStore(
    (state) => state.renameDiagram,
  );
  const [isEditing, setEditing] = useState<boolean>(false);
  const title: string = diagram === undefined ? '' : displayTitle(diagram.title);
  useEffect(() => {
    document.title = title === '' ? 'Nautink' : `${title} · Nautink`;
  }, [title]);
  useTitleRenameRequest(diagram !== undefined, setEditing);
  if (diagram === undefined) {
    return <span className="truncate text-muted-foreground max-md:hidden">Loading…</span>;
  }
  if (isEditing) {
    return (
      <InlineRenameInput
        initialValue={diagram.title}
        label="Diagram title"
        className="w-56 max-md:hidden"
        onCommit={(next) => {
          renameDiagram(diagram.id, next);
          setEditing(false);
        }}
        onCancel={() => {
          setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      title="Rename"
      className="h-7 min-w-0 truncate rounded-control px-1.5 font-medium hover:bg-muted max-md:hidden"
      onClick={() => {
        setEditing(true);
      }}
    >
      {title}
    </button>
  );
}

/** "Saved", "Saving…" or "Not saved", for the top bar and the status bar. */
export function SaveStatus({ className }: { className?: string }): ReactElement {
  const saveState: SaveState = useSaveState();
  return (
    <span
      className={cn(saveState === 'error' ? 'text-destructive' : undefined, className)}
      title="Diagrams are saved in this browser"
    >
      {SAVE_STATE_LABELS[saveState]}
    </span>
  );
}
