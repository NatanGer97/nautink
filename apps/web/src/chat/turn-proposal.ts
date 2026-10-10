import { findTurnDiagram } from './turn-edit.ts';
import { markProposalPending } from '../review/review-actions.ts';
import { nextProposalId, changeCount, useReviewStore } from '../review/review-store.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { AttemptResult } from './auto-fix.ts';
import type { ChatDeps } from './chat-deps.ts';
import type { TurnCodeSink } from './turn-edit.ts';
import type { Proposal, ProposalReview } from '../review/review-store.ts';
import type { WorkspaceState } from '../workspace/workspace-state.ts';

/**
 * A turn with review on (PRD §4.2, §4.3): the streamed code is a live preview on the canvas, never
 * the diagram's code, so nothing reaches the undo history or the versions until Accept.
 */
export class ProposalEdit implements TurnCodeSink {
  private readonly diagramId: string;
  private readonly workspace: () => WorkspaceState;
  private readonly replyIndexes: readonly number[];

  /** `replyIndexes` is the turn's own list, which grows as its attempts run. */
  constructor(
    target: { diagramId: string; workspace: () => WorkspaceState },
    replyIndexes: readonly number[],
  ) {
    this.diagramId = target.diagramId;
    this.workspace = target.workspace;
    this.replyIndexes = replyIndexes;
  }

  /** Always `null`: the undo step is only recorded on Accept. */
  readonly entryId: null = null;

  /** Shows `code` as the live build of the proposal. */
  show(code: string): void {
    if (findTurnDiagram(this.workspace(), this.diagramId) !== undefined) {
      useReviewStore
        .getState()
        .showLive(this.diagramId, { code, replyIndexes: [...this.replyIndexes] });
    }
  }

  /** A stop drops the live build: the diagram never changed. */
  revert(): void {
    useReviewStore.getState().clearLive(this.diagramId);
  }
}

/** What a reviewed turn needs to open its proposal. */
export interface ProposalTurn {
  diagramId: string;
  before: string;
  prompt: string;
  label: string;
  replyIndexes: readonly number[];
  deps: ChatDeps;
}

/** The live region's words for an open proposal. */
export function proposalAnnouncement(review: ProposalReview): string {
  const count: number = changeCount(review);
  const where: string = review.kind === 'code' ? 'in the code drawer' : 'on the canvas';
  return `Claude proposes ${String(count)} ${count === 1 ? 'change' : 'changes'}. Review ${where}.`;
}

function newProposal(turn: ProposalTurn, result: AttemptResult & { code: string }): Proposal {
  return {
    id: nextProposalId(),
    diagramId: turn.diagramId,
    before: turn.before,
    after: result.code,
    prompt: turn.prompt,
    label: turn.label,
    isValid: result.error === null,
    replyIndexes: [...turn.replyIndexes],
    review: null,
    deps: turn.deps,
  };
}

/** True when the turn ended with a changed diagram, still there to propose it on. */
function isProposable(
  turn: ProposalTurn,
  result: AttemptResult,
): result is AttemptResult & { code: string } {
  const isChanged: boolean =
    result.status === 'done' && result.code !== null && result.code !== turn.before;
  return isChanged && findTurnDiagram(turn.deps.workspace(), turn.diagramId) !== undefined;
}

/**
 * Ends a reviewed turn: a changed diagram becomes a proposal on the canvas (or in the code drawer
 * for code-only types); anything else drops the live build. Returns the announcement, or `null`
 * when there is nothing to propose.
 */
export async function proposeTurn(
  turn: ProposalTurn,
  result: AttemptResult,
): Promise<string | null> {
  if (!isProposable(turn, result)) {
    useReviewStore.getState().clearLive(turn.diagramId);
    return null;
  }
  const proposal: Proposal = newProposal(turn, result);
  useReviewStore.getState().openProposal(proposal);
  markProposalPending(proposal);
  const review: ProposalReview = await turn.deps.review(proposal.before, proposal.after);
  useReviewStore.getState().setReview(turn.diagramId, { proposalId: proposal.id, review });
  revealCodeReview(proposal, review);
  return proposalAnnouncement(review);
}

/** A code-only review lives in the code drawer, so it opens when the diagram is on view. */
export function revealCodeReview(proposal: Proposal, review: ProposalReview): void {
  if (review.kind === 'code' && proposal.deps.workspace().activeId === proposal.diagramId) {
    useUiStore.getState().setCodeDrawerOpen(true);
  }
}
