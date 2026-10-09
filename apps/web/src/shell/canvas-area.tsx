import { IconButton } from '@nautink/ui/icon-button';
import { ArrowUp } from 'lucide-react';

import { SHORTCUTS, shortcutLabel } from '../lib/shortcuts.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { ReactElement, ReactNode } from 'react';

export interface CanvasAreaProps {
  /** The canvas itself (Mermaid preview, visual editor, split). Empty until those land. */
  children?: ReactNode;
}

/** The floating prompt bar shown while the chat panel is closed (M3, M7). */
function PromptBar(): ReactElement {
  return (
    <div className="absolute bottom-5 left-1/2 flex w-[min(460px,calc(100%-32px))] -translate-x-1/2 items-center gap-2 rounded-float border border-input bg-panel py-1.5 pr-1.5 pl-3 shadow-float focus-within:border-ring">
      <label htmlFor="canvas-prompt" className="sr-only">
        Ask Claude to change this diagram
      </label>
      <input
        id="canvas-prompt"
        placeholder="Ask Claude to change this diagram…"
        className="min-w-0 flex-1 border-0 bg-transparent outline-none placeholder:text-muted-foreground"
      />
      <IconButton
        label="Send"
        shortcut={shortcutLabel(SHORTCUTS.send)}
        icon={<ArrowUp className="stroke-2" />}
        isDisabled
        className="rounded-track bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
      />
    </div>
  );
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
