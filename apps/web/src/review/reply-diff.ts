// "Diff" on a reply's change card: the code before and after that reply, in the code drawer as a
// read-only diff. Kept for the session only: proposals and edit steps are not saved.
import { create } from 'zustand';

import { useReviewStore } from './review-store.ts';
import { useChatStore } from '../chat/chat-store.ts';
import { useUiStore } from '../state/ui-store.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { Proposal } from './review-store.ts';
import type { EditEntry, EditStack } from '../workspace/edit-history.ts';
import type { StoreApi, UseBoundStore } from 'zustand';

/** Why "Diff" is off: the reply's code is gone (a reload, a new chat, or an old step). */
export const DIFF_GONE: string =
  "This reply's diff is no longer available. Diffs are kept until you reload; use History to compare versions.";

/** One reply's change: the code before it and after it. */
export interface ReplyDiff {
  diagramId: string;
  messageIndex: number;
  before: string;
  after: string;
}

interface ReplyDiffState {
  /** The reply diff on view in the code drawer, or null for the code. */
  shown: ReplyDiff | null;
}

/** Which reply diff the code drawer shows. */
export const useReplyDiffStore: UseBoundStore<StoreApi<ReplyDiffState>> = create<ReplyDiffState>()(
  () => ({ shown: null }),
);

/** The before and after of the edit step a reply recorded (review off), while the step is kept. */
function stepDiff(diagramId: string, messageIndex: number): ReplyDiff | null {
  const entryId: number | undefined = useChatStore.getState().replyEdits[diagramId]?.[messageIndex];
  const stack: EditStack | undefined = useWorkspaceStore.getState().histories[diagramId];
  const index: number = stack?.entries.findIndex((entry) => entry.id === entryId) ?? -1;
  const before: EditEntry | undefined = stack?.entries[index - 1];
  const after: EditEntry | undefined = stack?.entries[index];
  if (index < 1 || before === undefined || after === undefined) {
    return null;
  }
  return { diagramId, messageIndex, before: before.code, after: after.code };
}

/** A reply's diff: its reviewed proposal (accepted or rejected), else its edit step; else null. */
export function replyDiffFor(diagramId: string, messageIndex: number): ReplyDiff | null {
  const proposal: Proposal | undefined =
    useReviewStore.getState().closed[diagramId]?.[messageIndex];
  if (proposal !== undefined) {
    return { diagramId, messageIndex, before: proposal.before, after: proposal.after };
  }
  return stepDiff(diagramId, messageIndex);
}

/** Whether "Diff" can open this reply's diff now, kept in step with the stores it reads. */
export function useHasReplyDiff(diagramId: string, messageIndex: number): boolean {
  const hasProposal: boolean = useReviewStore(
    (state) => state.closed[diagramId]?.[messageIndex] !== undefined,
  );
  const entryId: number | undefined = useChatStore(
    (state) => state.replyEdits[diagramId]?.[messageIndex],
  );
  const hasStep: boolean = useWorkspaceStore((state) => {
    const index: number =
      state.histories[diagramId]?.entries.findIndex((entry) => entry.id === entryId) ?? -1;
    return entryId !== undefined && index > 0;
  });
  return hasProposal || hasStep;
}

/** Opens the code drawer on a reply's diff. Does nothing when the diff is gone. */
export function showReplyDiff(diagramId: string, messageIndex: number): void {
  const diff: ReplyDiff | null = replyDiffFor(diagramId, messageIndex);
  if (diff === null) {
    return;
  }
  useReplyDiffStore.setState({ shown: diff });
  useUiStore.getState().setCodeDrawerOpen(true);
}

/** Back to the code. */
export function closeReplyDiff(): void {
  useReplyDiffStore.setState({ shown: null });
}

/** The reply diff the drawer shows for `diagramId`, or null. */
export function useShownReplyDiff(diagramId: string | undefined): ReplyDiff | null {
  return useReplyDiffStore((state) =>
    state.shown !== null && state.shown.diagramId === diagramId ? state.shown : null,
  );
}
