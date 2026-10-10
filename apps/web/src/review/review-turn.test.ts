import { listVersions } from '@nautink/storage/versions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  acceptProposal,
  DIAGRAM_CHANGED,
  PROPOSAL_GONE,
  rejectProposal,
  REVIEW_BUSY,
  showAgainBlocker,
  showProposalAgain,
} from './review-actions.ts';
import { useReviewStore } from './review-store.ts';
import { controlledStream, eventsResponse, replyEvents } from '../../tests/chat-stream.ts';
import { loadedWorkspace } from '../../tests/workspace-fixtures.ts';
import { resetChatState, useChatStore } from '../chat/chat-store.ts';
import { sendChat, startNewChat, stopChat } from '../chat/send-chat.ts';
import { useUiStore } from '../state/ui-store.ts';
import { selectActiveDiagram, selectActiveStack } from '../workspace/use-workspace.ts';

import type { ProposalReview } from './review-store.ts';
import type { TestWorkspace } from '../../tests/workspace-fixtures.ts';
import type { ChatDeps } from '../chat/chat-deps.ts';
import type { MermaidError } from '../mermaid/validate.ts';
import type { Diagram } from '@nautink/storage/records';
import type { Mock } from 'vitest';

const VALID = 'flowchart TD\n  A --> B';
const INVALID = 'flowchart TD\n  A -->';
const FIXED = 'flowchart TD\n  A --> C';

const STRUCTURAL: ProposalReview = {
  kind: 'structural',
  editor: 'flow',
  counts: { added: 2, changed: 0, removed: 0 },
  code: VALID,
  targets: [],
};

function fenced(code: string): string {
  return `Here it is.\n\`\`\`mermaid\n${code}\n\`\`\``;
}

interface Harness {
  workspace: TestWorkspace;
  deps: ChatDeps;
  review: Mock<ChatDeps['review']>;
  notifyError: Mock<ChatDeps['notifyError']>;
  active: () => Diagram;
  steps: () => string[];
}

async function harness(responses: ((init?: RequestInit) => Response)[]): Promise<Harness> {
  const workspace = await loadedWorkspace();
  const queue = [...responses];
  const review = vi.fn<ChatDeps['review']>(async () => Promise.resolve(STRUCTURAL));
  const notifyError = vi.fn<ChatDeps['notifyError']>();
  const deps: ChatDeps = {
    agent: () => 'claude',
    fetchImpl: async (...[, init]) => {
      const next = queue.shift();
      if (next === undefined) {
        throw new Error('No more canned replies.');
      }
      return Promise.resolve(next(init));
    },
    validate: async (code: string): Promise<MermaidError | null> =>
      Promise.resolve(code === INVALID ? { message: 'Parse error on line 2', line: 2 } : null),
    workspace: workspace.store.getState,
    model: () => null,
    isChatOpen: () => true,
    notifyError,
    shouldReview: () => true,
    review,
  };
  const active = (): Diagram => selectActiveDiagram(workspace.store.getState())!;
  const steps = (): string[] =>
    selectActiveStack(workspace.store.getState())?.entries.map((entry) => entry.label) ?? [];
  return { workspace, deps, review, notifyError, active, steps };
}

function reply(text: string): () => Response {
  return () => eventsResponse(replyEvents(text));
}

afterEach(() => {
  resetChatState();
});

describe('a turn with review on', () => {
  it('holds the change as a proposal: no undo step, no version, the code unchanged', async () => {
    const h = await harness([reply(fenced(VALID))]);
    const before = h.active().code;
    await sendChat('Draw A to B', {}, h.deps);
    expect(h.active().code).toBe(before);
    expect(h.steps()).toEqual(['New blank flowchart']);
    expect(await listVersions(h.workspace.db(), h.active().id)).toEqual([]);
    const proposal = useReviewStore.getState().open[h.active().id];
    expect(proposal).toMatchObject({
      before,
      after: VALID,
      label: 'Claude: Draw A to B',
      isValid: true,
      replyIndexes: [1],
      review: STRUCTURAL,
    });
    expect(h.review).toHaveBeenCalledWith(before, VALID);
    expect(useReviewStore.getState().live).toEqual({});
    expect(useChatStore.getState().announcement).toBe(
      'Claude proposes 2 changes. Review on the canvas.',
    );
  });

  it('streams into a live preview, never into the diagram, and Stop drops it', async () => {
    const stream = controlledStream();
    const h = await harness([stream.response]);
    const before = h.active().code;
    const sending = sendChat('Draw it', {}, h.deps);
    await vi.waitFor(() => {
      expect(useChatStore.getState().busyDiagramId).toBe(h.active().id);
    });
    stream.send({ type: 'delta', text: '```mermaid\nflowchart LR\n  X --> Y' });
    await vi.waitFor(() => {
      expect(useReviewStore.getState().live[h.active().id]).toEqual({
        code: 'flowchart LR\n  X --> Y',
        replyIndexes: [1],
      });
    });
    expect(h.active().code).toBe(before);
    stopChat();
    await sending;
    expect(useReviewStore.getState().live).toEqual({});
    expect(useReviewStore.getState().open).toEqual({});
    expect(h.active().code).toBe(before);
    expect(h.steps()).toEqual(['New blank flowchart']);
  });

  it('proposes the code after auto-fix, for every reply of the turn', async () => {
    const h = await harness([reply(fenced(INVALID)), reply(fenced(FIXED))]);
    await sendChat('Draw it', {}, h.deps);
    expect(useReviewStore.getState().open[h.active().id]).toMatchObject({
      after: FIXED,
      replyIndexes: [1, 3],
      isValid: true,
    });
  });

  it('proposes nothing when the reply leaves the diagram as it was', async () => {
    const h = await harness([reply('No diagram here.')]);
    await sendChat('Explain', {}, h.deps);
    expect(useReviewStore.getState().open).toEqual({});
    expect(useChatStore.getState().announcement).toBe('Claude replied.');
  });

  it('opens the code drawer for a code-only review of the open diagram', async () => {
    const h = await harness([reply(fenced('pie\n  "A" : 1'))]);
    h.review.mockResolvedValue({ kind: 'code', reason: 'No editor.', changes: 1 });
    await sendChat('Make a pie', {}, h.deps);
    expect(useUiStore.getState().isCodeDrawerOpen).toBe(true);
    expect(useChatStore.getState().announcement).toBe(
      'Claude proposes 1 change. Review in the code drawer.',
    );
  });
});

describe('accept, reject and show again', () => {
  it('accept applies one claude undo step and the versions, and marks the reply', async () => {
    const h = await harness([reply(fenced(VALID))]);
    const before = h.active().code;
    await sendChat('Draw A to B', {}, h.deps);
    await acceptProposal(h.active().id);
    expect(h.active().code).toBe(VALID);
    expect(h.steps()).toEqual(['New blank flowchart', 'Claude: Draw A to B']);
    expect(selectActiveStack(h.workspace.store.getState())?.entries.at(-1)?.source).toBe('claude');
    const versions = await listVersions(h.workspace.db(), h.active().id);
    expect(versions.map((version) => [version.kind, version.label])).toEqual([
      ['claude', ''],
      ['manual', 'Before Claude'],
    ]);
    expect(h.active().messages[1]?.review).toEqual({ outcome: 'accepted', changes: 2 });
    expect(useChatStore.getState().replyEdits[h.active().id]?.[1]).toBeDefined();
    h.workspace.store.getState().undo();
    expect(h.active().code).toBe(before);
    expect(useReviewStore.getState().open).toEqual({});
  });

  it('accept saves the version with the agent that proposed it', async () => {
    const h = await harness([reply(fenced(VALID))]);
    await sendChat('Draw A to B', {}, { ...h.deps, agent: () => 'codex', model: () => null });
    await acceptProposal(h.active().id);
    const versions = await listVersions(h.workspace.db(), h.active().id);
    expect(versions.find((version) => version.kind === 'claude')?.agent).toBe('codex');
  });

  it('reject records nothing, and show again opens the same proposal', async () => {
    const h = await harness([reply(fenced(VALID))]);
    const before = h.active().code;
    await sendChat('Draw A to B', {}, h.deps);
    const id = h.active().id;
    rejectProposal(id);
    expect(h.active().code).toBe(before);
    expect(h.steps()).toEqual(['New blank flowchart']);
    expect(await listVersions(h.workspace.db(), id)).toEqual([]);
    expect(h.active().messages[1]?.review).toEqual({ outcome: 'rejected', changes: 2 });
    expect(useChatStore.getState().announcement).toBe('Change rejected. The diagram is unchanged.');
    showProposalAgain(id, 1);
    expect(useReviewStore.getState().open[id]?.after).toBe(VALID);
    expect(h.active().messages[1]?.review).toBeUndefined();
    await acceptProposal(id);
    expect(h.active().code).toBe(VALID);
  });

  it('says why a proposal cannot be shown again', async () => {
    const h = await harness([reply(fenced(VALID))]);
    await sendChat('Draw A to B', {}, h.deps);
    const id = h.active().id;
    const proposal = useReviewStore.getState().open[id]!;
    rejectProposal(id);
    const code = h.active().code;
    expect(showAgainBlocker({ proposal, code, isBusy: false })).toBeNull();
    expect(showAgainBlocker({ proposal, code: 'flowchart LR', isBusy: false })).toBe(
      DIAGRAM_CHANGED,
    );
    expect(showAgainBlocker({ proposal, code, isBusy: true })).toBe(REVIEW_BUSY);
    expect(showAgainBlocker({ proposal: undefined, code, isBusy: false })).toBe(PROPOSAL_GONE);
    h.workspace.store.getState().applyEdit('flowchart LR', { label: 'Typed', source: 'code' });
    showProposalAgain(id, 1);
    expect(useReviewStore.getState().open).toEqual({});
    showProposalAgain(id, 7);
    expect(useReviewStore.getState().open).toEqual({});
  });

  it('accepting a proposal that still fails to parse saves no version', async () => {
    const h = await harness([
      reply(fenced(INVALID)),
      reply(fenced(INVALID)),
      reply(fenced(INVALID)),
    ]);
    await sendChat('Draw it', {}, h.deps);
    expect(useReviewStore.getState().open[h.active().id]?.isValid).toBe(false);
    await acceptProposal(h.active().id);
    expect(h.active().code).toBe(INVALID);
    expect(await listVersions(h.workspace.db(), h.active().id)).toEqual([]);
  });

  it('reports a version that cannot be saved', async () => {
    const h = await harness([reply(fenced(VALID))]);
    await sendChat('Draw A to B', {}, h.deps);
    const id = h.active().id;
    const proposal = useReviewStore.getState().open[id]!;
    useReviewStore.getState().openProposal({
      ...proposal,
      deps: {
        ...proposal.deps,
        workspace: () => ({
          ...h.workspace.store.getState(),
          requireDb: (): never => {
            throw new Error('The database is closed.');
          },
        }),
      },
    });
    await acceptProposal(id);
    expect(h.notifyError).toHaveBeenCalledWith('Could not save a version. The database is closed.');
  });

  it('does nothing without an open proposal, or once the diagram is gone', async () => {
    const h = await harness([reply(fenced(VALID))]);
    await acceptProposal('missing');
    rejectProposal('missing');
    await sendChat('Draw A to B', {}, h.deps);
    const id = h.active().id;
    await h.workspace.store.getState().deleteDiagram(id);
    await acceptProposal(id);
    expect(useReviewStore.getState().open).toEqual({});
  });

  it('a new message rejects the open proposal; a new chat forgets it', async () => {
    const h = await harness([reply(fenced(VALID)), reply('Sure.'), reply(fenced(FIXED))]);
    await sendChat('Draw A to B', {}, h.deps);
    const id = h.active().id;
    await sendChat('Never mind', {}, h.deps);
    expect(h.active().messages[1]?.review?.outcome).toBe('rejected');
    expect(useReviewStore.getState().open).toEqual({});
    await sendChat('Try again', {}, h.deps);
    expect(useReviewStore.getState().open[id]).toBeDefined();
    startNewChat(id, h.deps);
    expect(useReviewStore.getState().open).toEqual({});
    expect(useReviewStore.getState().closed).toEqual({});
  });
});
