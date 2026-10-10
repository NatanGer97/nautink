import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { REVIEW_BAR_ROOM_PX } from './review-bar-room.ts';
import { nextProposalId, resetReviewState, useReviewStore } from './review-store.ts';
import { defaultChatDeps } from '../chat/chat-deps.ts';
import { fitOptions } from '../edit/canvas/use-canvas-fit.ts';
import { PROMPT_BAR_INSET_PX } from '../shell/prompt-bar-inset.ts';
import { useFitInsets } from '../shell/use-fit-insets.ts';
import { useUiStore } from '../state/ui-store.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { Proposal, ProposalReview } from './review-store.ts';

function proposal(diagramId: string, review: ProposalReview | null = null): Proposal {
  return {
    id: nextProposalId(),
    diagramId,
    before: 'flowchart TD',
    after: 'flowchart TD\n  A',
    prompt: 'Add A',
    label: 'Claude: Add A',
    isValid: true,
    replyIndexes: [1],
    review,
    deps: defaultChatDeps(),
  };
}

afterEach(() => {
  resetReviewState();
  useUiStore.getState().setCodeDrawerOpen(false);
});

describe('fit insets', () => {
  it("keep the proposal bar's room free at the top while it floats over the canvas", async () => {
    await useWorkspaceStore.getState().load();
    const id = useWorkspaceStore.getState().activeId ?? '';
    act(() => {
      useUiStore.getState().setActivePanel(null);
    });
    const { result } = renderHook(() => useFitInsets());
    expect(result.current).toEqual({ top: 0, bottom: PROMPT_BAR_INSET_PX });
    act(() => {
      useReviewStore.getState().openProposal(proposal(id));
    });
    expect(result.current.top).toBe(REVIEW_BAR_ROOM_PX.canvas);
    act(() => {
      useWorkspaceStore.getState().setView(id, 'split');
    });
    expect(result.current.top).toBe(REVIEW_BAR_ROOM_PX.split);
    act(() => {
      useWorkspaceStore.getState().setView(id, 'edit');
    });
    expect(result.current.top).toBe(REVIEW_BAR_ROOM_PX.editor);
    act(() => {
      useReviewStore
        .getState()
        .openProposal(proposal(id, { kind: 'code', reason: 'x', changes: 1 }));
      useUiStore.getState().setCodeDrawerOpen(true);
    });
    expect(result.current.top).toBe(0);
  });

  it('pad a visual editor fit by both insets', () => {
    expect(fitOptions({ top: 70, bottom: 76 }).padding).toEqual({
      top: '94px',
      left: '24px',
      right: '24px',
      bottom: '100px',
    });
  });
});
