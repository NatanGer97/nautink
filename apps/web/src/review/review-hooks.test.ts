import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { nextProposalId, useReviewStore } from './review-store.ts';
import { hasOwnKeys, reviewKeyAction, useReviewKeys } from './use-review-keys.ts';
import { shownCode } from './use-review.ts';
import { defaultChatDeps } from '../chat/chat-deps.ts';
import {
  EDGE_MARK_CLASSES,
  reviewMarksOf,
  withReviewClasses,
} from '../edit/review/review-marks.ts';

import type { Proposal, ProposalReview } from './review-store.ts';

vi.mock('./review-actions.ts', () => ({
  acceptProposal: vi.fn(async () => Promise.resolve()),
  rejectProposal: vi.fn(),
}));

const { acceptProposal, rejectProposal } = await import('./review-actions.ts');

function proposal(fields: Partial<Proposal> = {}): Proposal {
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
    ...fields,
  };
}

function key(init: KeyboardEventInit, target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('review keys', () => {
  it('Enter accepts and Esc rejects, unless a field, control or modifier has the key', () => {
    expect(reviewKeyAction(key({ key: 'Enter' }))).toBe('accept');
    expect(reviewKeyAction(key({ key: 'Escape' }))).toBe('reject');
    expect(reviewKeyAction(key({ key: 'a' }))).toBeNull();
    expect(reviewKeyAction(key({ key: 'Enter', metaKey: true }))).toBeNull();
    const field = document.createElement('textarea');
    expect(reviewKeyAction(key({ key: 'Enter' }, field))).toBeNull();
    expect(hasOwnKeys(document.createElement('button'))).toBe(true);
    expect(hasOwnKeys(document.createElement('div'))).toBe(false);
    expect(hasOwnKeys(null)).toBe(false);
  });

  it('listens only while the diagram has an open proposal', () => {
    const { rerender, unmount } = renderHook<undefined, { id: string | undefined }>(
      ({ id }) => {
        useReviewKeys(id);
      },
      { initialProps: { id: 'd1' } },
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(acceptProposal).not.toHaveBeenCalled();
    useReviewStore.getState().openProposal(proposal());
    rerender({ id: 'd1' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(acceptProposal).toHaveBeenCalledWith('d1');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(rejectProposal).toHaveBeenCalledWith('d1');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    rerender({ id: undefined });
    unmount();
  });
});

describe('review store and shown code', () => {
  it('shows the live build, then the proposal (its merged code once compared), then the diagram', () => {
    const diagram = { id: 'd1', code: 'flowchart TD' };
    expect(shownCode(diagram, useReviewStore.getState())).toBe('flowchart TD');
    useReviewStore.getState().showLive('d1', { code: 'flowchart TD\n  X', replyIndexes: [1] });
    expect(shownCode(diagram, useReviewStore.getState())).toBe('flowchart TD\n  X');
    const open = proposal();
    useReviewStore.getState().openProposal(open);
    expect(shownCode(diagram, useReviewStore.getState())).toBe(open.after);
    const review: ProposalReview = {
      kind: 'structural',
      editor: 'flow',
      counts: { added: 1, changed: 0, removed: 1 },
      code: 'merged',
      targets: [],
    };
    useReviewStore.getState().setReview('d1', { proposalId: open.id + 1, review });
    expect(useReviewStore.getState().open.d1?.review).toBeNull();
    useReviewStore.getState().setReview('d1', { proposalId: open.id, review });
    expect(shownCode(diagram, useReviewStore.getState())).toBe('merged');
    expect(useReviewStore.getState().closeProposal('d1')?.id).toBe(open.id);
    expect(useReviewStore.getState().closeProposal('d1')).toBeUndefined();
    expect(useReviewStore.getState().closed.d1?.[1]?.id).toBe(open.id);
    useReviewStore.getState().forget('d1');
    expect(useReviewStore.getState().closed).toEqual({});
  });
});

describe('editor review marks', () => {
  it('maps targets to ids and adds the mark classes to marked items only', () => {
    const marks = reviewMarksOf([
      { id: 'e1', kind: 'edge', key: 'k', sig: '', label: '', mark: 'removed', order: 0 },
    ]);
    expect(reviewMarksOf([]).size).toBe(0);
    const items = [{ id: 'e1', className: 'own' }, { id: 'e2' }];
    expect(withReviewClasses(items, marks, EDGE_MARK_CLASSES)).toEqual([
      { id: 'e1', className: `own ${EDGE_MARK_CLASSES.removed}` },
      { id: 'e2' },
    ]);
    expect(withReviewClasses(items, reviewMarksOf([]), EDGE_MARK_CLASSES)).toEqual(items);
  });
});
