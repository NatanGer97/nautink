import { ToggleGroup, ToggleGroupItem } from '@nautink/ui/components/toggle-group';

import type { ReactElement } from 'react';

export interface TypeFilterChipsProps {
  filters: readonly string[];
  value: string;
  onChange: (filter: string) => void;
}

/** All, Pinned and one chip per diagram type in the list (new in v2). The chosen one is inked. */
export function TypeFilterChips({ filters, value, onChange }: TypeFilterChipsProps): ReactElement {
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      value={value}
      onValueChange={(next: string) => {
        if (next !== '') {
          onChange(next);
        }
      }}
      aria-label="Filter by type"
      className="w-full flex-wrap justify-start"
    >
      {filters.map((filter) => (
        <ToggleGroupItem
          key={filter}
          value={filter}
          className="h-6 min-w-0 flex-none rounded-control border border-border bg-panel px-2.5 text-xs font-normal text-muted-foreground shadow-none hover:border-input hover:bg-panel hover:text-foreground data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:font-medium data-[state=on]:text-background"
        >
          {filter}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
