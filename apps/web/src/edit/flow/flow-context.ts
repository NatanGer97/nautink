import { createContext, useContext } from 'react';

import type { Context } from 'react';

/** What shape nodes need from the editor: inline renaming, and whether the canvas is read-only. */
export interface FlowEditorContextValue {
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  renameNode: (id: string, label: string) => void;
  isReadOnly: boolean;
}

export const FlowEditorContext: Context<FlowEditorContextValue> =
  createContext<FlowEditorContextValue>({
    editingId: null,
    setEditingId: (): void => undefined,
    renameNode: (): void => undefined,
    isReadOnly: true,
  });

export function useFlowEditorContext(): FlowEditorContextValue {
  return useContext(FlowEditorContext);
}
