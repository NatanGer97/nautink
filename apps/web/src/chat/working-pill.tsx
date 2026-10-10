import { Button } from '@nautink/ui/components/button';
import { cn } from '@nautink/ui/lib/utils';
import { LoaderCircle } from 'lucide-react';

import { elapsedSeconds, useClaudeActivity } from './claude-activity.ts';
import { stopChat } from './send-chat.ts';
import { useViewedVersion } from '../history/viewed-version.ts';
import { CANVAS_PLACEMENTS } from '../review/review-bar-room.ts';
import { PLACEMENT_CLASSES } from '../review/review-bar.tsx';
import { OUTLINE_BUTTON_CLASS } from '../shell/button-styles.ts';
import { useNow } from '../workspace/use-now.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { ClaudeActivity } from './claude-activity.ts';
import type { DiagramView } from '@nautink/storage/records';
import type { ReactElement } from 'react';

const TICK_MS: number = 1000;

/**
 * "Claude is editing · Drawing the diagram… · 4s" with Stop, over the canvas while a reply streams
 * into the open diagram. It sits where Claude's proposal bar appears next, in every view.
 */
export function ClaudeWorkingPill(): ReactElement | null {
  const diagramId: string | null = useWorkspaceStore((state) => state.activeId);
  const view: DiagramView | undefined = useWorkspaceStore(
    (state) => state.diagrams.find((item) => item.id === state.activeId)?.view,
  );
  const activity: ClaudeActivity | null = useClaudeActivity(diagramId);
  const isViewingVersion: boolean = useViewedVersion() !== null;
  if (activity === null || isViewingVersion) {
    return null;
  }
  return <WorkingPill activity={activity} placement={CANVAS_PLACEMENTS[view ?? 'preview']} />;
}

function WorkingPill({
  activity,
  placement,
}: {
  activity: ClaudeActivity;
  placement: (typeof CANVAS_PLACEMENTS)[DiagramView];
}): ReactElement {
  const seconds: number = elapsedSeconds(activity.startedAt, useNow(TICK_MS));
  return (
    <section
      aria-label="Claude is working"
      className={cn('flex items-center gap-2.5 whitespace-nowrap', PLACEMENT_CLASSES[placement])}
    >
      <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-accent-ink" />
      <p className="shrink-0 font-medium">Claude is editing</p>
      <p className="min-w-0 truncate text-muted-foreground">{activity.step}</p>
      <span className="shrink-0 font-mono text-xs text-faint tabular-nums">{`${String(seconds)}s`}</span>
      <Button
        variant="outline"
        size="sm"
        className={cn(OUTLINE_BUTTON_CLASS, 'ml-1')}
        onClick={stopChat}
      >
        Stop
      </Button>
    </section>
  );
}
