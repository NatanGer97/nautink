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

/** A request flag and the call that takes it back (⌘K asks, a component answers). */
function flagActions(
  ctx: StoreContext,
  flag: 'isSearchFocusRequested' | 'isTitleRenameRequested',
): [() => void, () => void] {
  return [
    (): void => {
      ctx.set({ [flag]: true });
    },
    (): void => {
      ctx.set({ [flag]: false });
    },
  ];
}

/** Panel and top bar requests from ⌘K, and `reset`. */
export function requestActions(ctx: StoreContext, initial: () => void): RequestActions {
  const [requestSearchFocus, takeSearchFocusRequest] = flagActions(ctx, 'isSearchFocusRequested');
  const [requestTitleRename, takeTitleRenameRequest] = flagActions(ctx, 'isTitleRenameRequested');
  return {
    startRename: (id: string): void => {
      ctx.set({ renamingId: findDiagram(ctx.get(), id).id });
    },
    endRename: (): void => {
      ctx.set({ renamingId: null });
    },
    requestSearchFocus,
    takeSearchFocusRequest,
    requestTitleRename,
    takeTitleRenameRequest,
    reset: (): void => {
      ctx.runtime.disconnect();
      initial();
    },
  };
}
