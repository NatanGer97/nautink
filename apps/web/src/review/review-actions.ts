import { changeCount, nextProposalId, useReviewStore } from './review-store.ts';
import { turnLabel } from '../chat/auto-fix.ts';
import { defaultChatDeps } from '../chat/chat-deps.ts';
import { useChatStore } from '../chat/chat-store.ts';
import { extractMermaid } from '../chat/extract-mermaid.ts';
import { findTurnDiagram } from '../chat/turn-edit.ts';
import { revealCodeReview } from '../chat/turn-proposal.ts';
import { saveTurnVersions } from '../chat/turn-versions.ts';

import type { Proposal, ProposalReview } from './review-store.ts';
import type { ChatDeps } from '../chat/chat-deps.ts';
import type { WorkspaceState } from '../workspace/workspace-state.ts';
import type { ChatMessage, ChatMessageReview, Diagram } from '@nautink/storage/records';

/** Shown on "Show again" when the diagram changed after the reply. */
export const DIAGRAM_CHANGED: string =
  'The diagram changed after this reply, so its proposal cannot be shown again.';

/** Shown on "Show again" when the proposal is no longer kept (a reload, a new chat). */
export const PROPOSAL_GONE: string = 'This proposal is no longer available. Ask Claude again.';

/** Shown on "Show again" while another proposal or a reply is on this diagram. */
export const REVIEW_BUSY: string = 'Finish the current review or reply first.';

/** Shown on "Review again" when the reply's diagram is already the diagram's code. */
export const ALREADY_APPLIED: string = 'The diagram already matches this reply.';

/** The outcome written while a proposal waits, so a reload can tell it was never reviewed. */
const PENDING: ChatMessageReview = { outcome: 'pending', changes: 0 };

function changesOf(proposal: Proposal): number {
  return proposal.review === null ? 0 : changeCount(proposal.review);
}

/** Writes the outcome (`pending` while the proposal waits) on the turn's replies. */
function markReplies(proposal: Proposal, review: ChatMessageReview): void {
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
  const { diagramId, before, after, prompt, deps } = proposal;
  try {
    await saveTurnVersions({ db: deps.workspace().requireDb(), diagramId, before, after, prompt });
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
  markReplies(proposal, PENDING);
  useChatStore.getState().announce(`Claude proposes ${String(changesOf(proposal))} changes.`);
}

/** Marks the turn's replies as waiting for review, until Accept or Reject replaces it. */
export function markProposalPending(proposal: Proposal): void {
  markReplies(proposal, PENDING);
}

/** What decides whether a reply whose review a reload cut off can be reviewed again. */
export interface ReviewAgainState {
  /** Claude's diagram in the reply, `null` when it has none. */
  replyCode: string | null;
  /** The diagram's code now, `undefined` once it is gone. */
  code: string | undefined;
  isBusy: boolean;
}

/** Why the reply cannot be reviewed again now, or `null` when it can. */
export function reviewAgainBlocker({ replyCode, code, isBusy }: ReviewAgainState): string | null {
  if (replyCode === null || code === undefined) {
    return PROPOSAL_GONE;
  }
  if (isBusy) {
    return REVIEW_BUSY;
  }
  return replyCode === code ? ALREADY_APPLIED : null;
}

/** The user message that asked for the reply at `messageIndex`, for the undo step's label. */
function askedFor(diagram: Diagram, messageIndex: number): string {
  const asked: ChatMessage | undefined = diagram.messages
    .slice(0, messageIndex)
    .filter((message: ChatMessage) => message.role === 'user')
    .at(-1);
  return asked?.text ?? 'Change';
}

function lostProposal(diagram: Diagram, messageIndex: number, deps: ChatDeps): Proposal | null {
  const after: string | null = extractMermaid(diagram.messages[messageIndex]?.text ?? '');
  if (after === null) {
    return null;
  }
  const prompt: string = askedFor(diagram, messageIndex);
  return {
    id: nextProposalId(),
    diagramId: diagram.id,
    before: diagram.code,
    after,
    prompt,
    label: turnLabel('user', prompt),
    isValid: true,
    replyIndexes: [messageIndex],
    review: null,
    deps,
  };
}

/**
 * Rebuilds the proposal of a reply whose review a reload cut off: the reply's diagram against the
 * diagram's code now, opened for Accept or Reject as if Claude had just replied.
 */
export async function reviewReplyAgain(
  diagramId: string,
  messageIndex: number,
  deps: ChatDeps = defaultChatDeps(),
): Promise<void> {
  const diagram: Diagram | undefined = findTurnDiagram(deps.workspace(), diagramId);
  const proposal: Proposal | null =
    diagram === undefined ? null : lostProposal(diagram, messageIndex, deps);
  if (proposal === null || proposal.after === proposal.before) {
    return;
  }
  proposal.isValid = (await deps.validate(proposal.after)) === null;
  useReviewStore.getState().openProposal(proposal);
  markReplies(proposal, PENDING);
  const review: ProposalReview = await deps.review(proposal.before, proposal.after);
  useReviewStore.getState().setReview(diagramId, { proposalId: proposal.id, review });
  revealCodeReview(proposal, review);
}
