import { useActiveDiagram } from './use-workspace.ts';

import type { Diagram } from '@nautink/storage/records';
import type { ReactElement } from 'react';

/**
 * TEMPORARY (wave 2): the open diagram's code, read-only, so the canvas shows something until the
 * Mermaid preview lands. The preview wave replaces this component; nothing else depends on it.
 */
export function ActiveCodeStandIn(): ReactElement {
  const diagram: Diagram | undefined = useActiveDiagram();
  if (diagram === undefined) {
    return (
      <div className="grid h-full place-items-center p-6 text-muted-foreground">
        Opening your diagrams…
      </div>
    );
  }
  return (
    <div className="h-full overflow-auto p-6">
      <pre
        data-slot="temporary-code-preview"
        aria-label="Diagram code"
        className="mx-auto w-fit max-w-full overflow-auto rounded-card border bg-panel px-4 py-3 font-mono text-code"
      >
        {diagram.code}
      </pre>
    </div>
  );
}
