import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  closeReplyDiff,
  replyDiffFor,
  showReplyDiff,
  useHasReplyDiff,
  useReplyDiffStore,
  useShownReplyDiff,
} from './reply-diff.ts';
import { nextProposalId, resetReviewState, useReviewStore } from './review-store.ts';
import { defaultChatDeps } from '../chat/chat-deps.ts';
import { resetChatState, useChatStore } from '../chat/chat-store.ts';
import { useUiStore } from '../state/ui-store.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { Proposal } from './review-store.ts';
import type { EditEntry } from '../workspace/undo/edit-history.ts';

function entry(id: number, code: string): EditEntry {
  return { id, code, label: 'x', source: 'claude', time: 1, sel: null, group: null, isOpen: false };
}

function proposal(): Proposal {
  return {
    id: nextProposalId(),
    diagramId: 'd1',
    before: 'flowchart TD',
    after: 'flowchart TD\n  A',
    prompt: 'Add A',
    agent: 'claude',
    label: 'Claude: Add A',
    isValid: true,
    replyIndexes: [1],
    review: null,
    deps: defaultChatDeps(),
  };
}

afterEach(() => {
  resetReviewState();
  resetChatState();
  closeReplyDiff();
  useWorkspaceStore.setState({ histories: {} });
  useUiStore.getState().setCodeDrawerOpen(false);
});

describe('reply diffs', () => {
  it("uses a reviewed reply's proposal, before and after", () => {
    useReviewStore.setState({ closed: { d1: { 1: proposal() } } });
    expect(replyDiffFor('d1', 1)).toEqual({
      diagramId: 'd1',
      messageIndex: 1,
      before: 'flowchart TD',
      after: 'flowchart TD\n  A',
    });
    expect(renderHook(() => useHasReplyDiff('d1', 1)).result.current).toBe(true);
  });

  it("uses an unreviewed reply's edit step while it is kept, after the step before it", () => {
    useWorkspaceStore.setState({
      histories: { d1: { entries: [entry(1, 'a'), entry(2, 'b')], index: 1, nextId: 3 } },
    });
    useChatStore.getState().linkReplyEdit('d1', { messageIndex: 3, entryId: 2 });
    useChatStore.getState().linkReplyEdit('d1', { messageIndex: 5, entryId: 1 });
    expect(replyDiffFor('d1', 3)).toMatchObject({ before: 'a', after: 'b' });
    expect(replyDiffFor('d1', 5)).toBeNull();
    expect(replyDiffFor('d1', 7)).toBeNull();
    expect(renderHook(() => useHasReplyDiff('d1', 3)).result.current).toBe(true);
    expect(renderHook(() => useHasReplyDiff('d1', 5)).result.current).toBe(false);
    expect(renderHook(() => useHasReplyDiff('d2', 3)).result.current).toBe(false);
  });

  it('opens the drawer on the diff for its diagram only, and goes back to the code', () => {
    showReplyDiff('d1', 1);
    expect(useReplyDiffStore.getState().shown).toBeNull();
    useReviewStore.setState({ closed: { d1: { 1: proposal() } } });
    showReplyDiff('d1', 1);
    expect(useUiStore.getState().isCodeDrawerOpen).toBe(true);
    expect(renderHook(() => useShownReplyDiff('d1')).result.current?.after).toBe(
      'flowchart TD\n  A',
    );
    expect(renderHook(() => useShownReplyDiff('d2')).result.current).toBeNull();
    closeReplyDiff();
    expect(useReplyDiffStore.getState().shown).toBeNull();
  });
});
