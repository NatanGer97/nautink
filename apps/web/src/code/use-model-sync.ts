import { useEffect } from 'react';

import { diagramIdOf, ensureModel, syncModel } from './editor-binding.ts';
import { selectActiveStack, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { EditorHandle } from './use-monaco-editor.ts';
import type { EditEntry, EditSelection, EditStack } from '../workspace/edit-history.ts';
import type { Diagram } from '@nautink/storage/records';
import type { editor, ISelection } from 'monaco-editor/editor/editor.api.js';

/** The cursor the current history step remembers for `code` (set by typing, used by undo/redo). */
function rememberedSelection(code: string): EditSelection | null {
  const stack: EditStack | undefined = selectActiveStack(useWorkspaceStore.getState());
  const entry: EditEntry | undefined = stack?.entries[stack.index];
  return entry?.code === code && entry.source === 'code' ? entry.sel : null;
}

function toMonacoSelection(sel: EditSelection): ISelection {
  return {
    selectionStartLineNumber: sel.anchorLine,
    selectionStartColumn: sel.anchorCol,
    positionLineNumber: sel.line,
    positionColumn: sel.col,
  };
}

/** After an undo or redo while typing, the cursor goes where the step left it, or to the change. */
function placeCursor(
  target: editor.IStandaloneCodeEditor,
  model: editor.ITextModel,
  endOffset: number,
): void {
  if (!target.hasTextFocus()) {
    return;
  }
  const sel: EditSelection | null = rememberedSelection(model.getValue());
  if (sel !== null && sel.line <= model.getLineCount()) {
    target.setSelection(toMonacoSelection(sel));
  } else {
    target.setPosition(model.getPositionAt(endOffset));
  }
  target.revealLineInCenterIfOutsideViewport(target.getPosition()?.lineNumber ?? 1);
}

/** Shows the open diagram's own model; a different diagram never shares Monaco's state. */
function useModelSwitch(handle: EditorHandle | null, diagramId: string): void {
  useEffect(() => {
    const diagram: Diagram | undefined = useWorkspaceStore
      .getState()
      .diagrams.find((item) => item.id === diagramId);
    if (handle === null || diagram === undefined) {
      return;
    }
    const model: editor.ITextModel = ensureModel(handle.monaco, diagramId, diagram.code);
    if (handle.editor.getModel() !== model) {
      handle.editor.setModel(model);
    }
  }, [handle, diagramId]);
}

/** Writes code changed elsewhere (undo, Claude, the visual editor) into the model as a minimal edit. */
function useModelSync(handle: EditorHandle | null, diagramId: string, code: string): void {
  useEffect(() => {
    const model: editor.ITextModel | null = handle?.editor.getModel() ?? null;
    if (handle === null || model === null || diagramIdOf(model) !== diagramId) {
      return;
    }
    const endOffset: number = syncModel(model, code);
    if (endOffset >= 0) {
      placeCursor(handle.editor, model, endOffset);
    }
  }, [handle, diagramId, code]);
}

/** The open diagram's model in the editor, kept equal to the store's code. */
export function useDiagramModel(
  handle: EditorHandle | null,
  diagramId: string,
  code: string,
): void {
  useModelSwitch(handle, diagramId);
  useModelSync(handle, diagramId, code);
}

/** Disposes the models of deleted diagrams. */
export function useDisposeDeletedModels(handle: EditorHandle | null): void {
  const ids: string = useWorkspaceStore((state) =>
    state.diagrams.map((diagram) => diagram.id).join('\n'),
  );
  useEffect(() => {
    if (handle === null) {
      return;
    }
    const alive: Set<string> = new Set<string>(ids.split('\n'));
    for (const model of handle.monaco.editor.getModels()) {
      const id: string | null = diagramIdOf(model);
      if (id !== null && !alive.has(id) && model !== handle.editor.getModel()) {
        model.dispose();
      }
    }
  }, [handle, ids]);
}
