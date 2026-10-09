import { PromptBar } from '../chat/prompt-bar.tsx';
import { useUiStore } from '../state/ui-store.ts';

import type { ReactElement, ReactNode } from 'react';

export interface CanvasAreaProps {
  /** The canvas itself (Mermaid preview, visual editor, split). Empty until those land. */
  children?: ReactNode;
}

/** The canvas region: the 20 px dot grid, the canvas slot, and the floating prompt bar. */
export function CanvasArea({ children }: CanvasAreaProps): ReactElement {
  const isChatOpen: boolean = useUiStore((state) => state.activePanel === 'chat');
  return (
    <main
      aria-label="Canvas"
      className="relative h-full min-w-0 flex-1 overflow-hidden bg-background bg-[radial-gradient(var(--grid-dot)_1px,transparent_1px)] bg-size-[20px_20px]"
    >
      <div data-slot="canvas-host" className="absolute inset-0">
        {children ?? (
          <div className="grid h-full place-items-center p-6 text-center">
            <p className="max-w-72 text-muted-foreground">
              Open a diagram or describe one in chat to see it here.
            </p>
          </div>
        )}
      </div>
      {isChatOpen ? null : <PromptBar />}
    </main>
  );
}
