import { changeCount, useReviewStore } from './review-store.ts';
import { useChatStore } from '../chat/chat-store.ts';
import { findTurnDiagram } from '../chat/turn-edit.ts';
import { saveTurnVersions } from '../chat/turn-versions.ts';

import type { Proposal } from './review-store.ts';
import type { WorkspaceState } from '../workspace/workspace-state.ts';
import type { NautinkDb } from '@nautink/storage/db';
import type { ChatMessage, ChatMessageReview } from '@nautink/storage/records';

/** Shown on "Show again" when the diagram changed after the reply. */
export const DIAGRAM_CHANGED: string =
  'The diagram changed after this reply, so its proposal cannot be shown again.';

/** Shown on "Show again" when the proposal is no longer kept (a reload, a new chat). */
export const PROPOSAL_GONE: string = 'This proposal is no longer available. Ask Claude again.';

/** Shown on "Show again" while another proposal or a reply is on this diagram. */
export const REVIEW_BUSY: string = 'Finish the current review or reply first.';

function changesOf(proposal: Proposal): number {
  return proposal.review === null ? 0 : changeCount(proposal.review);
}

/** Writes the outcome (or clears it, for "Show again") on the turn's replies. */
function markReplies(proposal: Proposal, review: ChatMessageReview | undefined): void {
  const state: WorkspaceState = proposal.deps.workspace();
  if (findTurnDiagram(state, proposal.diagramId) === undefined) {
    return;
  }
  const indexes: Set<number> = new Set<number>(proposal.replyIndexes);
  state.updateMessages(proposal.diagramId, (messages: readonly ChatMessage[]) =>
    messages.map((message: ChatMessage, index: number) =>
      indexes.has(index) ? { ...message, review } : message,
    ),
  );
}

async function saveVersions(proposal: Proposal): Promise<void> {
  const { diagramId, before, after, prompt, agent, deps } = proposal;
  try {
    const db: NautinkDb = deps.workspace().requireDb();
    await saveTurnVersions({ db, diagramId, before, after, prompt, agent });
  } catch (err) {
    const message: string = err instanceof Error ? err.message : String(err);
    deps.notifyError(`Could not save a version. ${message}`);
  }
}

/** Puts the proposal in the diagram as one undo step, linked to the replies' change cards. */
function applyProposal(proposal: Proposal): void {
  const { diagramId, after, label, deps } = proposal;
  const entryId: number = deps
    .workspace()
    .applyEdit(after, { label, source: 'claude', diagramId }).id;
  for (const messageIndex of proposal.replyIndexes) {
    useChatStore.getState().linkReplyEdit(diagramId, { messageIndex, entryId });
  }
}

/**
 * Accept: the proposal becomes one undo step (source `claude`) and, when it parses, one `claude`
 * version (plus "Before Claude" before the first one), exactly as an unreviewed turn (PRD §4.2).
 */
export async function acceptProposal(diagramId: string): Promise<void> {
  const proposal: Proposal | undefined = useReviewStore.getState().closeProposal(diagramId);
  if (
    proposal === undefined ||
    findTurnDiagram(proposal.deps.workspace(), diagramId) === undefined
  ) {
    return;
  }
  applyProposal(proposal);
  markReplies(proposal, { outcome: 'accepted', changes: changesOf(proposal) });
  useChatStore.getState().announce('Change applied.');
  if (proposal.isValid) {
    await saveVersions(proposal);
  }
}

/** Reject: the code stays as it is and nothing is recorded; the replies say "Rejected". */
export function rejectProposal(diagramId: string): void {
  const proposal: Proposal | undefined = useReviewStore.getState().closeProposal(diagramId);
  if (proposal === undefined) {
    return;
  }
  markReplies(proposal, { outcome: 'rejected', changes: changesOf(proposal) });
  useChatStore.getState().announce('Change rejected. The diagram is unchanged.');
}

/** What decides whether a reply's proposal can be shown again. */
export interface ShowAgainState {
  /** The kept proposal, if any. */
  proposal: Proposal | undefined;
  /** The diagram's code now, `undefined` once it is gone. */
  code: string | undefined;
  /** Another proposal is open on the diagram, or Claude is replying to it. */
  isBusy: boolean;
}

/** Why the reply's proposal cannot be shown again now, or `null` when it can. */
export function showAgainBlocker({ proposal, code, isBusy }: ShowAgainState): string | null {
  if (proposal === undefined || code === undefined) {
    return PROPOSAL_GONE;
  }
  if (isBusy) {
    return REVIEW_BUSY;
  }
  return code === proposal.before ? null : DIAGRAM_CHANGED;
}

/** Opens a rejected reply's proposal again, when the diagram has not changed since (PRD §4.2). */
export function showProposalAgain(diagramId: string, messageIndex: number): void {
  const review: ReturnType<typeof useReviewStore.getState> = useReviewStore.getState();
  const proposal: Proposal | undefined = review.closed[diagramId]?.[messageIndex];
  if (proposal === undefined) {
    return;
  }
  const code: string | undefined = findTurnDiagram(proposal.deps.workspace(), diagramId)?.code;
  const isBusy: boolean =
    diagramId in review.open || useChatStore.getState().busyDiagramId === diagramId;
  if (showAgainBlocker({ proposal, code, isBusy }) !== null) {
    return;
  }
  review.openProposal(proposal);
  markReplies(proposal, undefined);
  useChatStore.getState().announce(`Claude proposes ${String(changesOf(proposal))} changes.`);
}
