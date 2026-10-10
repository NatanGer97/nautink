import { toast } from 'sonner';

import { validateMermaid } from '../mermaid/validate.ts';
import { loadReview } from '../review/load-review.ts';
import { useUiStore } from '../state/ui-store.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { FetchLike } from './chat-client.ts';
import type { MermaidError } from '../mermaid/validate.ts';
import type { ProposalReview } from '../review/review-store.ts';
import type { WorkspaceState } from '../workspace/workspace-state.ts';
import type { ModelId } from '@nautink/contracts/models';

const ERROR_TOAST_MS: number = 6000;

/** Everything a chat turn reaches outside itself for, so tests can swap each part. */
export interface ChatDeps {
  fetchImpl: FetchLike;
  validate: (code: string) => Promise<MermaidError | null>;
  workspace: () => WorkspaceState;
  /** The model to ask for; `null` is Claude Code's default. */
  model: () => ModelId | null;
  /** True when the chat panel shows the reply, so an error needs no extra notice. */
  isChatOpen: () => boolean;
  notifyError: (message: string) => void;
  /** True when a turn should end in a proposal to accept or reject (PRD §4.2). */
  shouldReview: () => boolean;
  /** Compares a proposal with the code before the turn. */
  review: (before: string, after: string) => Promise<ProposalReview>;
}

/** The app's real parts: `fetch`, Mermaid, the workspace and UI stores, and toasts. */
export function defaultChatDeps(): ChatDeps {
  return {
    // Looked up on each call, so a stubbed `fetch` (tests) is the one used.
    fetchImpl: async (input, init) => fetch(input, init),
    validate: validateMermaid,
    workspace: useWorkspaceStore.getState,
    model: () => useUiStore.getState().defaultModel,
    isChatOpen: () => useUiStore.getState().activePanel === 'chat',
    notifyError: (message: string): void => {
      toast.error(message, { duration: ERROR_TOAST_MS });
    },
    shouldReview: () => useUiStore.getState().shouldReviewChanges,
    review: loadReview,
  };
}
