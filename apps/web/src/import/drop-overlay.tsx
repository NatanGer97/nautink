import { Upload } from 'lucide-react';

import { importFiles } from './import-files.ts';
import { useFileDrop } from './use-file-drop.ts';

import type { ReactElement } from 'react';

function onDropFiles(files: File[]): void {
  if (files.length > 0) {
    void importFiles(files);
  }
}

/** Drop .mmd, .mermaid, .md or a backup anywhere on the window to import it (v1's drop overlay). */
export function DropOverlay(): ReactElement | null {
  const isDragging: boolean = useFileDrop(onDropFiles);
  if (!isDragging) {
    return null;
  }
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/80 p-6"
    >
      <div className="flex max-w-sm flex-col items-center gap-2 rounded-dialog border border-dashed border-border-strong bg-panel px-8 py-7 text-center shadow-dialog">
        <Upload aria-hidden="true" className="size-5 text-muted-foreground" />
        <p className="font-semibold">Drop to import</p>
        <p className="text-xs text-muted-foreground">
          .mmd and .mermaid files become one diagram each. Markdown adds one diagram per mermaid
          block. A backup file is restored.
        </p>
      </div>
    </div>
  );
}
