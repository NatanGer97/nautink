import { createContext, useContext } from 'react';

import type { ClassEditing } from './class-types.ts';
import type { MemberRef } from '@nautink/editors/class/ops';
import type { Context } from 'react';

/** What class and note nodes need from the editor: in-place editing, and whether it is read-only. */
export interface ClassNodeContextValue {
  editing: ClassEditing | null;
  setEditing: (editing: ClassEditing | null) => void;
  isReadOnly: boolean;
  renameClass: (id: string, text: string) => void;
  setMemberText: (ref: MemberRef & { text: string }) => void;
  setNoteText: (id: string, text: string) => void;
}

export const ClassNodeContext: Context<ClassNodeContextValue> =
  createContext<ClassNodeContextValue>({
    editing: null,
    setEditing: (): void => undefined,
    isReadOnly: true,
    renameClass: (): void => undefined,
    setMemberText: (): void => undefined,
    setNoteText: (): void => undefined,
  });

export function useClassNodeContext(): ClassNodeContextValue {
  return useContext(ClassNodeContext);
}
