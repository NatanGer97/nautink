import { useEffect } from 'react';

import { diagramIdOf, errorMarkers } from './editor-binding.ts';
import { usePreviewStatus } from '../preview/preview-status.ts';

import type { EditorHandle } from './use-monaco-editor.ts';
import type { PreviewStatus } from '../preview/preview-status.ts';
import type { editor } from 'monaco-editor/editor/editor.api.js';

/** The owner name Monaco keeps the markers under. */
const MARKER_OWNER: string = 'mermaid';

/** Marks the line the preview's parse error points at, in the open diagram's model. */
export function useErrorMarkers(handle: EditorHandle | null, diagramId: string): void {
  const status: PreviewStatus = usePreviewStatus();
  useEffect(() => {
    const model: editor.ITextModel | null = handle?.editor.getModel() ?? null;
    if (handle === null || model === null || diagramIdOf(model) !== diagramId) {
      return;
    }
    const error: PreviewStatus['error'] = status.diagramId === diagramId ? status.error : null;
    handle.monaco.editor.setModelMarkers(
      model,
      MARKER_OWNER,
      errorMarkers(handle.monaco, model, error),
    );
  }, [handle, diagramId, status.diagramId, status.error]);
}
