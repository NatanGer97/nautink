import { useChatStore } from './chat-store.ts';
import { ChipButton } from './chip-button.tsx';
import { DIFF_GONE, showReplyDiff, useHasReplyDiff } from '../review/reply-diff.ts';
import { showAgainBlocker, showProposalAgain } from '../review/review-actions.ts';
import { useReviewStore } from '../review/review-store.ts';
import { canAmend } from '../workspace/edit-history.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { Proposal } from '../review/review-store.ts';
import type { EditStack } from '../workspace/edit-history.ts';
import type { WorkspaceState } from '../workspace/workspace-state.ts';
import type { ChatMessageReview } from '@nautink/storage/records';
import type { ReactElement } from 'react';

export interface ChangeCardProps {
  diagramId: string;
  /** The assistant message's index in the diagram's messages. */
  messageIndex: number;
  isStreaming: boolean;
  /** What the user did with the change this reply proposed (review on, PRD §4.2). */
  review?: ChatMessageReview | undefined;
}

/** A reply in a diagram's chat. */
interface ReplyRef {
  diagramId: string;
  messageIndex: number;
}

const UNDO_GONE: string =
  'Only the latest change can be undone here. Use History to go back further.';
const CARD_CLASS: string =
  'flex items-center justify-between gap-2 rounded-card border bg-subtle px-3 py-2.5';

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

/** "Diff": the reply's code before → after in the code drawer, while this session still has it. */
function DiffChip({ diagramId, messageIndex }: ReplyRef): ReactElement {
  const hasDiff: boolean = useHasReplyDiff(diagramId, messageIndex);
  const tip: { hint: string } | { disabledReason: string } = hasDiff
    ? { hint: 'Show what this reply changed in the code' }
    : { disabledReason: DIFF_GONE };
  return (
    <ChipButton
      {...tip}
      onClick={() => {
        showReplyDiff(diagramId, messageIndex);
      }}
    >
      Diff
    </ChipButton>
  );
}

/** Diff, and Undo while this reply's step is the latest. */
function ChangeActions({ isUndoable, ...reply }: ReplyRef & { isUndoable: boolean }): ReactElement {
  const undoTip: { hint: string } | { disabledReason: string } = isUndoable
    ? { hint: 'Undo this change (⌘Z)' }
    : { disabledReason: UNDO_GONE };
  return (
    <span className="flex gap-1">
      <DiffChip {...reply} />
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

/** Why "Show again" is off, kept in step with the diagram, the proposals and the chat. */
function useShowAgainBlocker(diagramId: string, messageIndex: number): string | null {
  const code: string | undefined = useWorkspaceStore(
    (state) => state.diagrams.find((item) => item.id === diagramId)?.code,
  );
  const proposal: Proposal | undefined = useReviewStore(
    (state) => state.closed[diagramId]?.[messageIndex],
  );
  const isOpen: boolean = useReviewStore((state) => diagramId in state.open);
  const isReplying: boolean = useChatStore((state) => state.busyDiagramId === diagramId);
  return showAgainBlocker({ proposal, code, isBusy: isOpen || isReplying });
}

/** "Rejected · diagram unchanged" with "Show again" (M2). */
function RejectedCard({ diagramId, messageIndex }: ChangeCardProps): ReactElement {
  const blocker: string | null = useShowAgainBlocker(diagramId, messageIndex);
  const tip: { hint: string } | { disabledReason: string } =
    blocker === null
      ? { hint: 'Show the proposal on the canvas again' }
      : { disabledReason: blocker };
  return (
    <div className={CARD_CLASS}>
      <span className="text-muted-foreground">Rejected · diagram unchanged</span>
      <span className="flex gap-1">
        <DiffChip diagramId={diagramId} messageIndex={messageIndex} />
        <ChipButton
          {...tip}
          onClick={() => {
            showProposalAgain(diagramId, messageIndex);
          }}
        >
          Show again
        </ChipButton>
      </span>
    </div>
  );
}

/** "Waiting for your review" while the reply's proposal is open (M2). */
function PendingCard({ isCodeReview }: { isCodeReview: boolean }): ReactElement {
  return (
    <div className={CARD_CLASS}>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">Waiting for your review</span>
        <span className="text-xs text-muted-foreground">
          {isCodeReview
            ? 'Changes are shown in the code drawer'
            : 'Changes are shown on the canvas'}
        </span>
      </span>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent-ink" />
    </div>
  );
}

/** The reply's state in the review: open (and how it is shown), or not open. */
function usePending(diagramId: string, messageIndex: number): { isCodeReview: boolean } | null {
  const proposal: Proposal | undefined = useReviewStore((state) => state.open[diagramId]);
  if (!proposal?.replyIndexes.includes(messageIndex)) {
    return null;
  }
  return { isCodeReview: proposal.review?.kind === 'code' };
}

function cardTitle(review: ChatMessageReview | undefined): ReactElement | string {
  if (review?.outcome !== 'accepted') {
    return 'Diagram updated';
  }
  const noun: string = review.changes === 1 ? 'change' : 'changes';
  return (
    <>
      <span className="text-success">Applied</span>
      {review.changes > 0 ? ` · ${String(review.changes)} ${noun}` : null}
    </>
  );
}

/** True while the reply belongs to a reviewed turn that is still running (auto-fix included). */
function useIsLiveReply(diagramId: string, messageIndex: number): boolean {
  return useReviewStore(
    (state) => state.live[diagramId]?.replyIndexes.includes(messageIndex) ?? false,
  );
}

/** The card under a reply that changed the diagram (M1, M2): what happened, and what you can do. */
export function ChangeCard(props: ChangeCardProps): ReactElement {
  const { diagramId, messageIndex, review } = props;
  const isStreaming: boolean = useIsLiveReply(diagramId, messageIndex) || props.isStreaming;
  const isUndoable: boolean = useUndoableEntry(diagramId, messageIndex);
  const pending: { isCodeReview: boolean } | null = usePending(diagramId, messageIndex);
  if (pending !== null) {
    return <PendingCard isCodeReview={pending.isCodeReview} />;
  }
  if (review?.outcome === 'rejected' && !isStreaming) {
    return <RejectedCard {...props} />;
  }
  return (
    <div className={CARD_CLASS}>
      <span className="font-medium">{isStreaming ? 'Writing diagram…' : cardTitle(review)}</span>
      {isStreaming ? null : (
        <ChangeActions diagramId={diagramId} messageIndex={messageIndex} isUndoable={isUndoable} />
      )}
    </div>
  );
}
