import { createContext, useContext } from 'react';

import type { Context } from 'react';

/** What entity nodes and relationship lines need from the editor: inline editing and read-only. */
export interface ErEditorContextValue {
  /** The entity name or relationship id being edited inline. */
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  /** The header's rename: the alias when there is one, the name otherwise. */
  renameEntity: (name: string, text: string) => void;
  setRelLabel: (id: string, label: string) => void;
  selectRel: (id: string) => void;
  isReadOnly: boolean;
}

export const ErEditorContext: Context<ErEditorContextValue> = createContext<ErEditorContextValue>({
  editingId: null,
  setEditingId: (): void => undefined,
  renameEntity: (): void => undefined,
  setRelLabel: (): void => undefined,
  selectRel: (): void => undefined,
  isReadOnly: true,
});

export function useErEditorContext(): ErEditorContextValue {
  return useContext(ErEditorContext);
}
