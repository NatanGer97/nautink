import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@nautink/ui/components/dropdown-menu';
import { IconButton } from '@nautink/ui/icon-button';
import { cn } from '@nautink/ui/lib/utils';
import { ChevronDown, Redo2, Undo2 } from 'lucide-react';

import { redoStep, undoStep } from './edit-history.ts';
import { useHistoryOverride } from './history-guard.ts';
import { relativeTime } from './relative-time.ts';
import { useNow } from './use-now.ts';
import { useActiveEditStack, useWorkspaceStore } from './use-workspace.ts';
import { SHORTCUTS, shortcutLabel } from '../lib/shortcuts.ts';

import type { EditEntry, EditSource, EditStack } from './edit-history.ts';
import type { ReactElement } from 'react';

/** How the step menu names each source (v1's `UndoRedo.jsx`). */
export const EDIT_SOURCE_LABELS: Readonly<Record<EditSource, string>> = {
  code: 'Code',
  visual: 'Visual',
  claude: 'Claude',
  restore: 'Restore',
  import: 'Import',
  template: 'Template',
  duplicate: 'Duplicate',
  open: 'Opened',
  external: 'Edit',
};

interface StepItemProps {
  entry: EditEntry;
  index: number;
  current: number;
  now: number;
  onJump: (index: number) => void;
}

/** One step: label, source and time; "Now" on the current one, later (redo) steps muted. */
function StepItem({ entry, index, current, now, onJump }: StepItemProps): ReactElement {
  const isCurrent: boolean = index === current;
  return (
    <DropdownMenuItem
      disabled={isCurrent}
      aria-current={isCurrent ? 'step' : undefined}
      className={cn(
        'justify-between gap-2.5 rounded-control px-2.5 py-1.5 data-[disabled]:opacity-100',
        isCurrent ? 'bg-muted' : undefined,
        index > current ? 'text-faint' : undefined,
      )}
      onSelect={() => {
        onJump(index);
      }}
    >
      <span className="flex min-w-0 flex-col gap-px text-left">
        <span className="truncate">{entry.label}</span>
        <span className="text-xs text-faint">
          {`${EDIT_SOURCE_LABELS[entry.source]} · ${relativeTime(entry.time, now)}`}
        </span>
      </span>
      {isCurrent ? (
        <span className="rounded-xs bg-accent-wash px-1.5 text-2xs font-medium text-accent-ink-strong">
          Now
        </span>
      ) : null}
    </DropdownMenuItem>
  );
}

/** The caret next to Undo: every step, newest first; picking one jumps there (M7). */
function StepMenu({
  stack,
  isHeld,
}: {
  stack: EditStack | undefined;
  isHeld: boolean;
}): ReactElement {
  const jumpTo: (index: number) => void = useWorkspaceStore((state) => state.jumpTo);
  const now: number = useNow();
  const entries: readonly EditEntry[] = stack?.entries ?? [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isHeld || entries.length <= 1}>
        <IconButton label="Undo history" icon={<ChevronDown />} className="w-6 [&_svg]:size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[420px] w-[300px] rounded-float p-1.5 shadow-menu"
      >
        <DropdownMenuLabel className="px-2.5 pt-2 pb-1 text-2xs font-medium text-faint">
          Undo history
        </DropdownMenuLabel>
        {entries
          .map((entry, index) => ({ entry, index }))
          .reverse()
          .map(({ entry, index }) => (
            <StepItem
              key={entry.id}
              entry={entry}
              index={index}
              current={stack?.index ?? 0}
              now={now}
              onJump={jumpTo}
            />
          ))}
        <p className="mt-1 border-t border-border-subtle px-2.5 pt-2 pb-1.5 text-xs text-faint">
          Go back to any step. Later steps stay as redo until you edit.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The steps undo and redo would take, or what undo does instead while a guard holds the history. */
function useNextSteps(): { undo: string | null; redo: string | null; isHeld: boolean } {
  const stack: EditStack | undefined = useActiveEditStack();
  const override: string | null = useHistoryOverride(useWorkspaceStore((state) => state.activeId));
  if (override !== null) {
    return { undo: override, redo: null, isHeld: true };
  }
  return {
    undo: (stack === undefined ? undefined : undoStep(stack))?.label ?? null,
    redo: (stack === undefined ? undefined : redoStep(stack))?.label ?? null,
    isHeld: false,
  };
}

/** Top bar ↶ ↷ for the open diagram, with the step menu (PRD §3.5, M7). */
export function UndoRedoControls(): ReactElement {
  const stack: EditStack | undefined = useActiveEditStack();
  const undo: () => void = useWorkspaceStore((state) => state.undo);
  const redo: () => void = useWorkspaceStore((state) => state.redo);
  const next: { undo: string | null; redo: string | null; isHeld: boolean } = useNextSteps();
  return (
    <div className="flex items-center">
      <div className="flex items-center rounded-control has-[[aria-expanded=true]]:bg-muted">
        <IconButton
          label={next.undo === null ? 'Undo' : `Undo: ${next.undo}`}
          shortcut={shortcutLabel(SHORTCUTS.undo)}
          icon={<Undo2 />}
          isDisabled={next.undo === null}
          onClick={undo}
        />
        <StepMenu stack={stack} isHeld={next.isHeld} />
      </div>
      <IconButton
        label={next.redo === null ? 'Redo' : `Redo: ${next.redo}`}
        shortcut={shortcutLabel(SHORTCUTS.redo)}
        icon={<Redo2 />}
        isDisabled={next.redo === null}
        onClick={redo}
      />
    </div>
  );
}
