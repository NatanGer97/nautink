import { useEffect } from 'react';

import type { EditorHandle } from './use-monaco-editor.ts';

/** Locks the editor while `reason` is set; Monaco shows the reason when someone tries to type. */
export function useEditorReadOnly(handle: EditorHandle | null, reason: string | null): void {
  useEffect(() => {
    handle?.editor.updateOptions({
      readOnly: reason !== null,
      readOnlyMessage: { value: reason ?? '' },
    });
  }, [handle, reason]);
}
