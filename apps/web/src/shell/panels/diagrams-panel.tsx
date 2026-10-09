import { Button } from '@nautink/ui/components/button';
import { Input } from '@nautink/ui/components/input';
import { Plus } from 'lucide-react';

import { EmptyState } from './empty-state.tsx';
import { PanelHeader } from './panel-header.tsx';
import { useUiStore } from '../../state/ui-store.ts';
import { OUTLINE_BUTTON_CLASS } from '../button-styles.ts';

import type { ReactElement } from 'react';

/** The diagrams library (M3). The list arrives with storage. */
export function DiagramsPanel(): ReactElement {
  const setTemplatesOpen: (isOpen: boolean) => void = useUiStore((state) => state.setTemplatesOpen);
  const openTemplates = (): void => {
    setTemplatesOpen(true);
  };
  return (
    <>
      <PanelHeader
        title="Diagrams"
        actions={
          <Button
            variant="outline"
            size="xs"
            className={OUTLINE_BUTTON_CLASS}
            onClick={openTemplates}
          >
            <Plus aria-hidden="true" />
            New
          </Button>
        }
      />
      <div className="shrink-0 px-3 pt-3">
        <label htmlFor="diagram-search" className="sr-only">
          Search diagrams
        </label>
        <Input
          id="diagram-search"
          placeholder="Search titles and content"
          className="h-8 bg-subtle"
          disabled
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto" data-slot="diagram-list">
        <EmptyState
          title="No diagrams yet"
          action={
            <Button size="sm" className="mt-2" onClick={openTemplates}>
              Create a diagram
            </Button>
          }
        >
          Start from a template, or describe one in chat.
        </EmptyState>
      </div>
      <div className="shrink-0 border-t border-border-subtle px-3 py-2.5 text-xs text-muted-foreground">
        0 diagrams
      </div>
    </>
  );
}
