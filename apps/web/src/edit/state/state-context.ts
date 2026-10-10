import { createContext, useContext } from 'react';

import type { Context } from 'react';

/** What state nodes need from the editor: inline renaming, and whether the canvas is read-only. */
export interface StateEditorContextValue {
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  /** Renames a state or rewrites a note from its inline editor (v1's `ctx.rename`). */
  rename: (id: string, text: string) => void;
  isReadOnly: boolean;
}

export const StateEditorContext: Context<StateEditorContextValue> =
  createContext<StateEditorContextValue>({
    editingId: null,
    setEditingId: (): void => undefined,
    rename: (): void => undefined,
    isReadOnly: true,
  });

export function useStateEditorContext(): StateEditorContextValue {
  return useContext(StateEditorContext);
}
