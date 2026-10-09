import { useChatStore } from './chat-store.ts';
import { ChipButton } from './chip-button.tsx';
import { canAmend } from '../workspace/edit-history.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { EditStack } from '../workspace/edit-history.ts';
import type { WorkspaceState } from '../workspace/workspace-state.ts';
import type { ReactElement } from 'react';

export interface ChangeCardProps {
  diagramId: string;
  /** The assistant message's index in the diagram's messages. */
  messageIndex: number;
  isStreaming: boolean;
}

const DIFF_PENDING: string = 'Comparing versions arrives with change review.';
const UNDO_GONE: string =
  'Only the latest change can be undone here. Use History to go back further.';

/** Whether this reply's edit step can be undone from its card: it must still be the latest step. */
function useUndoableEntry(diagramId: string, messageIndex: number): boolean {
  const entryId: number | undefined = useChatStore(
    (state) => state.replyEdits[diagramId]?.[messageIndex],
  );
  return useWorkspaceStore((state: WorkspaceState) => {
    const stack: EditStack | undefined = state.histories[diagramId];
    const isOpen: boolean = state.activeId === diagramId;
    return isOpen && entryId !== undefined && stack !== undefined && canAmend(stack, entryId);
  });
}

/** Diff (a placeholder until review lands) and Undo, while this reply's step is the latest. */
function ChangeActions({ isUndoable }: { isUndoable: boolean }): ReactElement {
  const undoTip: { hint: string } | { disabledReason: string } = isUndoable
    ? { hint: 'Undo this change (⌘Z)' }
    : { disabledReason: UNDO_GONE };
  return (
    <span className="flex gap-1">
      <ChipButton disabledReason={DIFF_PENDING}>Diff</ChipButton>
      <ChipButton
        {...undoTip}
        onClick={() => {
          useWorkspaceStore.getState().undo();
        }}
      >
        Undo
      </ChipButton>
    </span>
  );
}

/** The card under a reply that changed the diagram (M1): what happened, Diff and Undo. */
export function ChangeCard({
  diagramId,
  messageIndex,
  isStreaming,
}: ChangeCardProps): ReactElement {
  const isUndoable: boolean = useUndoableEntry(diagramId, messageIndex);
  return (
    <div className="flex items-center justify-between gap-2 rounded-card border bg-subtle px-3 py-2.5">
      <span className="font-medium">{isStreaming ? 'Writing diagram…' : 'Diagram updated'}</span>
      {isStreaming ? null : <ChangeActions isUndoable={isUndoable} />}
    </div>
  );
}
