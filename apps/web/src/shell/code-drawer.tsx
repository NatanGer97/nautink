import { fileSlug } from '@nautink/storage/diagram-files';
import { Button } from '@nautink/ui/components/button';
import { IconButton } from '@nautink/ui/icon-button';
import { X } from 'lucide-react';
import { toast } from 'sonner';

import { CodeEditor } from '../code/code-editor.tsx';
import { useUiStore } from '../state/ui-store.ts';
import { useActiveDiagram } from '../workspace/use-workspace.ts';

import type { Diagram } from '@nautink/storage/records';
import type { ReactElement } from 'react';

async function copyCode(code: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(code);
    toast('Code copied');
  } catch (err) {
    toast.error(`Could not copy the code: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** The code drawer on the right of the canvas (M3): the open diagram's Mermaid in Monaco. */
export function CodeDrawer(): ReactElement {
  const setCodeDrawerOpen: (isOpen: boolean) => void = useUiStore(
    (state) => state.setCodeDrawerOpen,
  );
  const diagram: Diagram | undefined = useActiveDiagram();
  return (
    <section aria-label="Code" className="flex h-full flex-col bg-panel">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle pr-2 pl-3.5">
        <span className="flex min-w-0 items-center gap-2">
          <h2 className="font-semibold">Code</h2>
          <span className="truncate text-xs text-muted-foreground">
            {`${fileSlug(diagram?.title ?? '')}.mmd`}
          </span>
        </span>
        <span className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="xs"
            disabled={diagram === undefined}
            onClick={() => {
              void copyCode(diagram?.code ?? '');
            }}
          >
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
      {diagram === undefined ? (
        <p className="px-3.5 py-2.5 text-muted-foreground">Opening your diagrams…</p>
      ) : (
        <CodeEditor diagramId={diagram.id} code={diagram.code} />
      )}
    </section>
  );
}
