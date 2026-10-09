import { Button } from '@nautink/ui/components/button';
import { IconButton } from '@nautink/ui/icon-button';
import { X } from 'lucide-react';

import { useUiStore } from '../state/ui-store.ts';

import type { ReactElement, ReactNode } from 'react';

export interface CodeDrawerProps {
  /** The code editor. Empty until Monaco lands. */
  children?: ReactNode;
}

/** The code drawer on the right of the canvas (M3). */
export function CodeDrawer({ children }: CodeDrawerProps): ReactElement {
  const setCodeDrawerOpen: (isOpen: boolean) => void = useUiStore(
    (state) => state.setCodeDrawerOpen,
  );
  return (
    <section aria-label="Code" className="flex h-full flex-col bg-panel">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle pr-2 pl-3.5">
        <span className="flex items-center gap-2">
          <h2 className="font-semibold">Code</h2>
          <span className="text-xs text-muted-foreground">untitled.mmd</span>
        </span>
        <span className="flex items-center gap-0.5">
          <Button variant="ghost" size="xs" disabled>
            Copy
          </Button>
          <IconButton
            label="Close code"
            icon={<X />}
            onClick={() => {
              setCodeDrawerOpen(false);
            }}
          />
        </span>
      </div>
      <div
        data-slot="code-editor"
        className="min-h-0 flex-1 overflow-auto py-2.5 font-mono text-code"
      >
        {children ?? <p className="px-3.5 text-muted-foreground">The code editor loads here.</p>}
      </div>
    </section>
  );
}
