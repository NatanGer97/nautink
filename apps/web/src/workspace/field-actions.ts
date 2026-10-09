import { applyPatch, findDiagram, requireDb } from './workspace-context.ts';

import type { FieldActions, RequestActions, StoreContext } from './workspace-state.ts';
import type { NautinkDb } from '@nautink/storage/db';
import type { ChatMessage, DiagramView } from '@nautink/storage/records';

/** Chat messages, session id, draft and view, each saved through autosave. */
export function fieldActions(ctx: StoreContext): FieldActions {
  return {
    updateMessages: (id, update): void => {
      const messages: ChatMessage[] = update(findDiagram(ctx.get(), id).messages);
      applyPatch(ctx, id, { messages });
    },
    setSessionId: (id: string, sessionId: string | null): void => {
      applyPatch(ctx, id, { sessionId });
    },
    setDraft: (id: string, draft: string): void => {
      applyPatch(ctx, id, { draft });
    },
    setView: (id: string, view: DiagramView): void => {
      applyPatch(ctx, id, { view });
    },
    flushSaves: async (): Promise<void> => ctx.runtime.autosaver.flush(),
    getDb: (): NautinkDb => requireDb(ctx),
    requireDb: (): NautinkDb => ctx.runtime.requireDb(),
  };
}

/** Panel requests from ⌘K, and `reset`. */
export function requestActions(ctx: StoreContext, initial: () => void): RequestActions {
  return {
    startRename: (id: string): void => {
      ctx.set({ renamingId: findDiagram(ctx.get(), id).id });
    },
    endRename: (): void => {
      ctx.set({ renamingId: null });
    },
    requestSearchFocus: (): void => {
      ctx.set({ isSearchFocusRequested: true });
    },
    takeSearchFocusRequest: (): void => {
      ctx.set({ isSearchFocusRequested: false });
    },
    reset: (): void => {
      ctx.runtime.disconnect();
      initial();
    },
  };
}
