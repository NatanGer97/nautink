import { useEffect } from 'react';

import {
  diagramIdOf,
  disposeVersionModels,
  ensureModel,
  ensureVersionModel,
  syncModel,
} from './editor-binding.ts';
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

/** A saved version shown read-only in place of the diagram's code (M5). */
export interface ViewedCode {
  id: string;
  code: string;
}

function modelToShow(
  handle: EditorHandle,
  diagramId: string,
  viewed: ViewedCode | null,
): editor.ITextModel | null {
  if (viewed !== null) {
    return ensureVersionModel(handle.monaco, viewed);
  }
  const diagram: Diagram | undefined = useWorkspaceStore
    .getState()
    .diagrams.find((item) => item.id === diagramId);
  return diagram === undefined ? null : ensureModel(handle.monaco, diagramId, diagram.code);
}

/** Shows the open diagram's own model (or a viewed version's); diagrams never share Monaco's state. */
function useModelSwitch(
  handle: EditorHandle | null,
  diagramId: string,
  viewed: ViewedCode | null,
): void {
  const viewedId: string | null = viewed?.id ?? null;
  const viewedCode: string = viewed?.code ?? '';
  useEffect(() => {
    const shown: ViewedCode | null = viewedId === null ? null : { id: viewedId, code: viewedCode };
    const model: editor.ITextModel | null =
      handle === null ? null : modelToShow(handle, diagramId, shown);
    if (handle === null || model === null) {
      return;
    }
    if (handle.editor.getModel() !== model) {
      handle.editor.setModel(model);
    }
    disposeVersionModels(handle.monaco, model);
  }, [handle, diagramId, viewedId, viewedCode]);
}

/** Writes code changed elsewhere (undo, Claude, the visual editor) into the model as a minimal edit. */
function useModelSync(
  handle: EditorHandle | null,
  { diagramId, code, viewedId }: { diagramId: string; code: string; viewedId: string | null },
): void {
  useEffect(() => {
    const model: editor.ITextModel | null = handle?.editor.getModel() ?? null;
    if (handle === null || model === null || diagramIdOf(model) !== diagramId) {
      return;
    }
    const endOffset: number = syncModel(model, code);
    if (endOffset >= 0) {
      placeCursor(handle.editor, model, endOffset);
    }
  }, [handle, diagramId, code, viewedId]);
}

/** The open diagram's model in the editor, kept equal to the store's code; or a viewed version. */
export function useDiagramModel(
  handle: EditorHandle | null,
  { diagramId, code, viewed }: { diagramId: string; code: string; viewed: ViewedCode | null },
): void {
  useModelSwitch(handle, diagramId, viewed);
  useModelSync(handle, { diagramId, code, viewedId: viewed?.id ?? null });
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
