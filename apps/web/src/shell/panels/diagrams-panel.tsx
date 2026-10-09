import { searchDiagrams } from '@nautink/storage/search';
import { Button } from '@nautink/ui/components/button';
import { Plus } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { EmptyState } from './empty-state.tsx';
import { PanelHeader } from './panel-header.tsx';
import {
  ALL_FILTER,
  applyTypeFilter,
  typeFilters,
} from '../../workspace/panel/diagram-list-model.ts';
import { DiagramList } from '../../workspace/panel/diagram-list.tsx';
import { DiagramSearchBox } from '../../workspace/panel/diagram-search-box.tsx';
import { TypeFilterChips } from '../../workspace/panel/type-filter-chips.tsx';
import { useWorkspaceStore } from '../../workspace/use-workspace.ts';
import { OUTLINE_BUTTON_CLASS } from '../button-styles.ts';

import type { LoadStatus } from '../../workspace/workspace-state.ts';
import type { Diagram } from '@nautink/storage/records';
import type { SearchHit } from '@nautink/storage/search';
import type { ReactElement, RefObject } from 'react';

interface ListStateProps {
  status: LoadStatus;
  query: string;
  onClearSearch: () => void;
}

/** What the list area shows instead of rows: loading, a load error, or no match. */
function ListState({ status, query, onClearSearch }: ListStateProps): ReactElement {
  const loadError: string | null = useWorkspaceStore((state) => state.loadError);
  if (status === 'error') {
    return (
      <EmptyState
        title="Could not open your diagrams"
        action={
          <Button
            size="sm"
            className="mt-2"
            onClick={() => void useWorkspaceStore.getState().load()}
          >
            Try again
          </Button>
        }
      >
        {loadError ?? 'The diagram database did not open.'}
      </EmptyState>
    );
  }
  if (status !== 'ready') {
    return <EmptyState title="Opening your diagrams…">This takes a moment.</EmptyState>;
  }
  if (query.trim() === '') {
    return <EmptyState title="No diagrams of this type yet">Pick another type above.</EmptyState>;
  }
  return (
    <EmptyState
      title={`No diagrams match “${query.trim()}”`}
      action={
        <Button
          variant="outline"
          size="sm"
          className={OUTLINE_BUTTON_CLASS}
          onClick={onClearSearch}
        >
          Clear search
        </Button>
      }
    >
      Search looks in titles and code.
    </EmptyState>
  );
}

function countLabel(count: number): string {
  return count === 1 ? '1 diagram' : `${String(count)} diagrams`;
}

/** The search results after the type chip, and the chips themselves. */
function useFilteredHits(
  query: string,
  filter: string,
): { hits: SearchHit[]; filters: string[]; active: string } {
  const diagrams: readonly Diagram[] = useWorkspaceStore((state) => state.diagrams);
  const filters: string[] = useMemo(() => typeFilters(diagrams), [diagrams]);
  const active: string = filters.includes(filter) ? filter : ALL_FILTER;
  const hits: SearchHit[] = useMemo(
    () => applyTypeFilter(searchDiagrams(diagrams, query), active),
    [diagrams, query, active],
  );
  return { hits, filters, active };
}

/** "Diagrams" with the New diagram button. */
function DiagramsPanelHeader({ isReady }: { isReady: boolean }): ReactElement {
  return (
    <PanelHeader
      title="Diagrams"
      actions={
        <Button
          variant="outline"
          size="xs"
          className={OUTLINE_BUTTON_CLASS}
          disabled={!isReady}
          onClick={() => void useWorkspaceStore.getState().createDiagram()}
        >
          <Plus aria-hidden="true" />
          New diagram
        </Button>
      }
    />
  );
}

/** The diagrams library (M3): new, search, type chips and the list, pinned first. */
export function DiagramsPanel(): ReactElement {
  const status: LoadStatus = useWorkspaceStore((state) => state.status);
  const total: number = useWorkspaceStore((state) => state.diagrams.length);
  const [query, setQuery] = useState<string>('');
  const [filter, setFilter] = useState<string>(ALL_FILTER);
  const [cursorId, setCursorId] = useState<string | null>(null);
  const searchRef: RefObject<HTMLInputElement | null> = useRef<HTMLInputElement>(null);
  const listRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  const { hits, filters, active } = useFilteredHits(query, filter);
  const clearSearch = (): void => {
    setQuery('');
    searchRef.current?.focus();
  };
  return (
    <>
      <DiagramsPanelHeader isReady={status === 'ready'} />
      <div className="flex shrink-0 flex-col gap-2.5 px-3 pt-3 pb-2">
        <DiagramSearchBox
          query={query}
          inputRef={searchRef}
          onQueryChange={(next) => {
            setQuery(next);
            setCursorId(null);
          }}
          onEnterList={() => {
            setCursorId(hits[0]?.diagram.id ?? null);
            listRef.current?.focus();
          }}
          onOpenFirst={() => {
            const first: SearchHit | undefined = hits[0];
            if (first !== undefined) {
              useWorkspaceStore.getState().selectDiagram(first.diagram.id);
            }
          }}
        />
        <TypeFilterChips filters={filters} value={active} onChange={setFilter} />
      </div>
      {hits.length === 0 ? (
        <ListState status={status} query={query} onClearSearch={clearSearch} />
      ) : (
        <DiagramList
          hits={hits}
          listRef={listRef}
          cursorId={cursorId}
          onCursorChange={setCursorId}
          onEscape={() => {
            if (query !== '') {
              clearSearch();
            }
          }}
        />
      )}
      <div className="shrink-0 border-t border-border-subtle px-3 py-2.5 text-xs text-faint">
        {countLabel(total)}
      </div>
    </>
  );
}
