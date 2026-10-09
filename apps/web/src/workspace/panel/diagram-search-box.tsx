import { Input } from '@nautink/ui/components/input';
import { useEffect } from 'react';

import { useWorkspaceStore } from '../use-workspace.ts';

import type { KeyboardEvent, ReactElement, RefObject } from 'react';

export interface DiagramSearchBoxProps {
  query: string;
  onQueryChange: (query: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  /** ArrowDown: move into the list. */
  onEnterList: () => void;
  /** Enter: open the first result. */
  onOpenFirst: () => void;
}

/** Searches titles and code; ⌘K "Search diagrams" focuses it. */
export function DiagramSearchBox({
  query,
  onQueryChange,
  inputRef,
  onEnterList,
  onOpenFirst,
}: DiagramSearchBoxProps): ReactElement {
  const isFocusRequested: boolean = useWorkspaceStore((state) => state.isSearchFocusRequested);
  useEffect(() => {
    if (isFocusRequested) {
      inputRef.current?.focus();
      useWorkspaceStore.getState().takeSearchFocusRequest();
    }
  }, [isFocusRequested, inputRef]);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onEnterList();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onOpenFirst();
    } else if (event.key === 'Escape' && query !== '') {
      event.stopPropagation();
      onQueryChange('');
    }
  };
  return (
    <>
      <label htmlFor="diagram-search" className="sr-only">
        Search diagrams
      </label>
      <Input
        id="diagram-search"
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search titles and content"
        autoComplete="off"
        className="h-8 bg-subtle"
        onChange={(event) => {
          onQueryChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
      />
    </>
  );
}
