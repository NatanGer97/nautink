import { useEffect, useState } from 'react';

import { DiagramRow, rowDomId } from './diagram-row.tsx';
import { listKeyAction } from './list-keys.ts';
import { useNow } from '../use-now.ts';
import { useWorkspaceStore } from '../use-workspace.ts';

import type { ListKeyAction } from './list-keys.ts';
import type { WorkspaceState } from '../store/workspace-state.ts';
import type { SearchHit } from '@nautink/storage/search';
import type { FocusEvent, KeyboardEvent, ReactElement, RefObject } from 'react';

export interface DiagramListProps {
  hits: readonly SearchHit[];
  listRef: RefObject<HTMLDivElement | null>;
  cursorId: string | null;
  onCursorChange: (id: string | null) => void;
  /** Escape in the list: clear the search and go back to the search box. */
  onEscape: () => void;
}

function focusList(listRef: RefObject<HTMLDivElement | null>): void {
  listRef.current?.focus({ preventScroll: true });
}

/** Runs what a key on the list asked for. */
function runKeyAction(
  action: ListKeyAction,
  { props, openMenu }: { props: DiagramListProps; openMenu: (id: string) => void },
): void {
  const store: WorkspaceState = useWorkspaceStore.getState();
  if (action.type === 'escape') {
    props.onEscape();
    return;
  }
  props.onCursorChange(action.id);
  if (action.type === 'open') {
    store.selectDiagram(action.id);
  } else if (action.type === 'rename') {
    store.startRename(action.id);
  } else if (action.type === 'menu') {
    openMenu(action.id);
  }
}

/** The diagram list: a listbox with a keyboard cursor, inline rename and row menus (M3). */
export function DiagramList(props: DiagramListProps): ReactElement {
  const { hits, listRef, cursorId, onCursorChange } = props;
  const activeId: string | null = useWorkspaceStore((state) => state.activeId);
  const renamingId: string | null = useWorkspaceStore((state) => state.renamingId);
  const [menuId, setMenuId] = useState<string | null>(null);
  const now: number = useNow();
  const ids: string[] = hits.map((hit) => hit.diagram.id);
  useEffect(() => {
    if (cursorId !== null) {
      document.getElementById(rowDomId(cursorId))?.scrollIntoView({ block: 'nearest' });
    }
  }, [cursorId]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const action: ListKeyAction | undefined = listKeyAction(event, { ids, cursorId });
    if (action === undefined || (action.type === 'escape' && event.defaultPrevented)) {
      return;
    }
    event.preventDefault();
    runKeyAction(action, { props, openMenu: setMenuId });
  };
  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    const isCursorShown: boolean = cursorId !== null && ids.includes(cursorId);
    if (event.target === event.currentTarget && !isCursorShown) {
      onCursorChange(activeId !== null && ids.includes(activeId) ? activeId : (ids[0] ?? null));
    }
  };
  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Diagrams"
      tabIndex={0}
      aria-activedescendant={cursorId === null ? undefined : rowDomId(cursorId)}
      className="group/list flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto px-2 pt-1 pb-3 outline-none"
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      {hits.map((hit) => (
        <DiagramRowItem
          key={hit.diagram.id}
          hit={hit}
          now={now}
          state={{ activeId, renamingId, cursorId, menuId }}
          listProps={props}
          onMenuChange={setMenuId}
        />
      ))}
    </div>
  );
}

interface DiagramRowItemProps {
  hit: SearchHit;
  now: number;
  state: {
    activeId: string | null;
    renamingId: string | null;
    cursorId: string | null;
    menuId: string | null;
  };
  listProps: DiagramListProps;
  onMenuChange: (id: string | null) => void;
}

/** A row wired to the store and the list's cursor, rename and menu state. */
function DiagramRowItem({
  hit,
  now,
  state,
  listProps,
  onMenuChange,
}: DiagramRowItemProps): ReactElement {
  const { id } = hit.diagram;
  const store: WorkspaceState = useWorkspaceStore.getState();
  const { listRef, onCursorChange } = listProps;
  const endRename = (): void => {
    store.endRename();
    focusList(listRef);
  };
  return (
    <DiagramRow
      hit={hit}
      now={now}
      isActive={id === state.activeId}
      isCursor={id === state.cursorId}
      isRenaming={id === state.renamingId}
      isMenuOpen={id === state.menuId}
      onOpen={() => {
        onCursorChange(id);
        store.selectDiagram(id);
        focusList(listRef);
      }}
      onStartRename={() => {
        store.startRename(id);
      }}
      onRename={(title: string) => {
        store.renameDiagram(id, title);
        endRename();
      }}
      onEndRename={endRename}
      onMenuOpenChange={(isOpen: boolean) => {
        onCursorChange(id);
        onMenuChange(isOpen ? id : null);
      }}
      onMenuClosed={() => {
        focusList(listRef);
      }}
    />
  );
}
