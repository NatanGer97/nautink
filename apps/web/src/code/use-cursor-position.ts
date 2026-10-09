import { useEffect, useState } from 'react';

import type { EditorHandle } from './use-monaco-editor.ts';

export interface CursorPosition {
  line: number;
  column: number;
}

/** The editor's cursor, for the drawer's "Ln 8, Col 3". */
export function useCursorPosition(handle: EditorHandle | null): CursorPosition {
  const [position, setPosition] = useState<CursorPosition>({ line: 1, column: 1 });
  useEffect(() => {
    if (handle === null) {
      return undefined;
    }
    const subscription: { dispose: () => void } = handle.editor.onDidChangeCursorPosition(
      (event) => {
        setPosition({ line: event.position.lineNumber, column: event.position.column });
      },
    );
    return (): void => {
      subscription.dispose();
    };
  }, [handle]);
  return position;
}
