import { useIsPromptBarShown } from './prompt-bar-inset.ts';
import { useClaudeActivity } from '../chat/claude-activity.ts';
import { PromptBar } from '../chat/prompt-bar.tsx';
import { ClaudeWorkingPill } from '../chat/working-pill.tsx';
import { CanvasReview } from '../review/canvas-review.tsx';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { ReactElement, ReactNode } from 'react';

export interface CanvasAreaProps {
  /** The canvas itself (Mermaid preview, visual editor, split). Empty until those land. */
  children?: ReactNode;
}

/** A thin teal bar sliding along the top of the canvas while Claude works on the open diagram. */
function WorkingProgress(): ReactElement {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden">
      <div className="h-full w-1/3 animate-[nautink-progress_1.6s_ease-in-out_infinite] bg-linear-to-r from-transparent via-accent-ink to-transparent" />
    </div>
  );
}

/**
 * The canvas region: the dot grid, the canvas slot, Claude's proposal bar and the prompt bar. While
 * Claude edits the open diagram, `data-claude-working` lets the canvas pulse the selected shapes.
 */
export function CanvasArea({ children }: CanvasAreaProps): ReactElement {
  const isPromptBarShown: boolean = useIsPromptBarShown();
  const activeId: string | null = useWorkspaceStore((state) => state.activeId);
  const isClaudeWorking: boolean = useClaudeActivity(activeId) !== null;
  return (
    <main
      aria-label="Canvas"
      data-claude-working={isClaudeWorking ? '' : undefined}
      className="@container relative h-full min-w-0 flex-1 overflow-hidden bg-background bg-[radial-gradient(var(--grid-dot)_1px,transparent_1px)] bg-size-[20px_20px]"
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
      {isClaudeWorking ? <WorkingProgress /> : null}
      {children === undefined ? null : <ClaudeWorkingPill />}
      {children === undefined ? null : <CanvasReview />}
      {isPromptBarShown ? <PromptBar /> : null}
    </main>
  );
}
