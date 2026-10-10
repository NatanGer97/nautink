import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@nautink/ui/components/dialog';
import { useState } from 'react';

import { TemplateCard } from './template-card.tsx';
import {
  filterCount,
  filterTemplates,
  GALLERY_FILTERS,
  templateDraft,
} from './template-gallery.ts';
import { useAgentName } from '../chat/agent-name.ts';
import { useUiStore } from '../state/ui-store.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { DiagramTemplate } from './template-data.ts';
import type { GalleryFilter, TemplateStart } from './template-gallery.ts';
import type { ReactElement } from 'react';

interface FilterListProps {
  value: GalleryFilter;
  onChange: (filter: GalleryFilter) => void;
  onDescribe: () => void;
}

/** The categories with their counts, and the nudge to describe the diagram instead. */
function FilterList({ value, onChange, onDescribe }: FilterListProps): ReactElement {
  const name: string = useAgentName();
  return (
    <nav
      aria-label="Categories"
      className="flex w-[200px] shrink-0 flex-col gap-0.5 border-r border-border-subtle p-3 max-sm:hidden"
    >
      {GALLERY_FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          aria-pressed={filter === value}
          className="flex h-8 items-center justify-between rounded-control px-2.5 text-muted-foreground hover:text-foreground aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground"
          onClick={() => {
            onChange(filter);
          }}
        >
          {filter}
          <span className="text-xs text-faint">{filterCount(filter)}</span>
        </button>
      ))}
      <span className="flex-1" />
      <button
        type="button"
        className="rounded-track border border-dashed border-border-strong p-3 text-left text-xs leading-normal text-muted-foreground hover:text-foreground"
        onClick={onDescribe}
      >
        Or describe it, and {name} drafts the first version.
      </button>
    </nav>
  );
}

function TemplateGrid(props: {
  templates: readonly DiagramTemplate[];
  onStart: (template: DiagramTemplate, start: TemplateStart) => void;
}): ReactElement {
  if (props.templates.length === 0) {
    return (
      <p className="p-6 text-center text-muted-foreground">No template matches that search.</p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {props.templates.map((template) => (
        <TemplateCard key={template.id} template={template} onStart={props.onStart} />
      ))}
    </div>
  );
}

/** The new-diagram gallery (M6): 14 types by category, each from its example or blank. */
export function TemplateGalleryDialog(): ReactElement {
  const isOpen: boolean = useUiStore((state) => state.isTemplatesOpen);
  const setOpen: (isOpen: boolean) => void = useUiStore((state) => state.setTemplatesOpen);
  const [filter, setFilter] = useState<GalleryFilter>('All');
  const [query, setQuery] = useState<string>('');
  const onStart = (template: DiagramTemplate, start: TemplateStart): void => {
    setOpen(false);
    void useWorkspaceStore.getState().createDiagrams([templateDraft(template, start)]);
  };
  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="flex h-[min(700px,calc(100%-48px))] w-[min(1040px,calc(100%-48px))] max-w-none flex-col gap-0 overflow-hidden rounded-dialog bg-panel p-0 shadow-dialog sm:max-w-none">
        <div className="flex items-center gap-4 border-b border-border-subtle py-4 pr-14 pl-6">
          <div className="flex shrink-0 flex-col gap-0.5">
            <DialogTitle className="text-lg font-semibold">New diagram</DialogTitle>
            <DialogDescription className="text-xs">
              Start from an example, or blank
            </DialogDescription>
          </div>
          <input
            type="search"
            aria-label="Search templates"
            placeholder="Search templates"
            value={query}
            className="h-[34px] min-w-0 flex-1 rounded-track border bg-subtle px-3 outline-none placeholder:text-faint focus-visible:border-ring"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </div>
        <div className="flex min-h-0 flex-1">
          <FilterList
            value={filter}
            onChange={setFilter}
            onDescribe={() => {
              setOpen(false);
              useUiStore.getState().focusComposer();
            }}
          />
          <div className="min-w-0 flex-1 overflow-auto px-5 pt-4 pb-6">
            <TemplateGrid templates={filterTemplates(filter, query)} onStart={onStart} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
