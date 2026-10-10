import { erEditor } from '@nautink/editors/er/model';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ER_LAYOUT } from './er-layout.ts';
import { liveSelection, selectedItems, selectionOfIds } from './er-selection.ts';
import { NO_SELECTION } from './er-types.ts';
import {
  clearSelection,
  publishSelection,
  useSelectionRequests,
} from '../selection/canvas-selection.ts';
import { useEditorCore } from '../use-editor-core.ts';

import type { ErActionContext } from './er-actions.ts';
import type { ErCanvasSelection } from './er-types.ts';
import type { VisualEditorProps } from '../editor-props.ts';
import type { EditorCore } from '../use-editor-core.ts';
import type { ErModel } from '@nautink/editors/er/model';
import type { Point } from '@nautink/visual-core/geometry';
import type { Dispatch, SetStateAction } from 'react';

export interface ErEditorState {
  core: EditorCore<ErModel>;
  /** The selection, minus anything an outside change removed. */
  selection: ErCanvasSelection;
  setSelection: Dispatch<SetStateAction<ErCanvasSelection>>;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  context: ErActionContext;
  toCanvas: (point: Point) => Point;
}

interface SelectionSync {
  diagramId: string;
  core: EditorCore<ErModel>;
  selection: ErCanvasSelection;
  setSelection: Dispatch<SetStateAction<ErCanvasSelection>>;
}

/** Reports the selection to the app-wide store, and selects what Split's preview asks for. */
function useSelectionSync({ diagramId, core, selection, setSelection }: SelectionSync): void {
  const { model, getModel } = core;
  useEffect(() => {
    publishSelection(diagramId, selectedItems(model, selection));
  }, [diagramId, model, selection]);
  useEffect(() => clearSelection, []);
  const select: (ids: readonly string[]) => void = useCallback(
    (ids: readonly string[]): void => {
      setSelection(selectionOfIds(getModel(), ids));
    },
    [getModel, setSelection],
  );
  useSelectionRequests(diagramId, select);
}

function useActionContext(
  core: EditorCore<ErModel>,
  setSelection: Dispatch<SetStateAction<ErCanvasSelection>>,
  setEditingId: (id: string | null) => void,
): ErActionContext {
  const { getModel, commit, book, requestFit } = core;
  return useMemo(
    () => ({ getModel, commit, positions: book, select: setSelection, setEditingId, requestFit }),
    [getModel, commit, book, setSelection, setEditingId, requestFit],
  );
}

function useErSelection(
  core: EditorCore<ErModel>,
): [ErCanvasSelection, Dispatch<SetStateAction<ErCanvasSelection>>] {
  const [rawSelection, setSelection] = useState<ErCanvasSelection>(NO_SELECTION);
  const selection: ErCanvasSelection = useMemo(
    () => liveSelection(rawSelection, core.model),
    [rawSelection, core.model],
  );
  return [selection, setSelection];
}

/** The ER editor's state: the shared core, the selection, inline editing and its actions. */
export function useErEditor(props: VisualEditorProps): ErEditorState {
  const core: EditorCore<ErModel> = useEditorCore({ props, module: erEditor, layout: ER_LAYOUT });
  const [selection, setSelection] = useErSelection(core);
  const [editingId, setEditingId] = useState<string | null>(null);
  useSelectionSync({ diagramId: props.diagramId, core, selection, setSelection });
  const context: ErActionContext = useActionContext(core, setSelection, setEditingId);
  const { screenToFlowPosition } = useReactFlow();
  return {
    core,
    selection,
    setSelection,
    editingId,
    setEditingId,
    context,
    toCanvas: screenToFlowPosition,
  };
}
