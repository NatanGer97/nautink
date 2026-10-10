import { dagreLayout, placeNodes, tagLabels } from '@nautink/editors/state/layout';
import { stateEditor } from '@nautink/editors/state/model';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { placeMissing } from './state-positions.ts';
import { liveSelection, selectedItems, selectionOfIds } from './state-selection.ts';
import { NO_SELECTION } from './state-types.ts';
import {
  clearSelection,
  publishSelection,
  useSelectionRequests,
} from '../selection/canvas-selection.ts';
import { useEditorCore } from '../use-editor-core.ts';

import type { StateActionContext } from './state-actions.ts';
import type { StateSelection } from './state-types.ts';
import type { VisualEditorProps } from '../editor-props.ts';
import type { EditorCore, EditorLayout } from '../use-editor-core.ts';
import type { StateModel } from '@nautink/editors/state/types';
import type { Point } from '@nautink/visual-core/geometry';
import type { Dispatch, SetStateAction } from 'react';

/** The state diagram's layout functions from `@nautink/editors`, for `useEditorCore`. */
export const STATE_LAYOUT: EditorLayout<StateModel> = {
  place: placeNodes,
  layout: dagreLayout,
  tag: tagLabels,
};

export interface StateEditorState {
  core: EditorCore<StateModel>;
  /** The selection, minus anything an outside change removed. */
  selection: StateSelection;
  setSelection: Dispatch<SetStateAction<StateSelection>>;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  shouldFocusEdgeLabel: boolean;
  setFocusEdgeLabel: (isFocused: boolean) => void;
  context: StateActionContext;
  toCanvas: (point: Point) => Point;
}

interface SelectionSync {
  diagramId: string;
  core: EditorCore<StateModel>;
  selection: StateSelection;
  setSelection: Dispatch<SetStateAction<StateSelection>>;
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

/** The core's commit, after giving a spot to any leaf the edit made without one. */
function placingCommit({
  getModel,
  book,
  commit,
}: Pick<EditorCore<StateModel>, 'getModel' | 'book' | 'commit'>): (
  next: StateModel,
  label: string,
) => void {
  return (next: StateModel, label: string): void => {
    const previous: StateModel | null = getModel();
    if (previous !== null) {
      book.replace(placeMissing({ previous, next, positions: book.get() }));
    }
    commit(next, label);
  };
}

function useActionContext(
  core: EditorCore<StateModel>,
  setSelection: Dispatch<SetStateAction<StateSelection>>,
  setEditingId: (id: string | null) => void,
): StateActionContext {
  const { getModel, commit, setModel, book, requestFit } = core;
  return useMemo(
    () => ({
      getModel,
      commit: placingCommit({ getModel, book, commit }),
      setModel,
      positions: book,
      select: setSelection,
      setEditingId,
      requestFit,
    }),
    [getModel, commit, setModel, book, setSelection, setEditingId, requestFit],
  );
}

function useStateSelection(
  core: EditorCore<StateModel>,
): [StateSelection, Dispatch<SetStateAction<StateSelection>>] {
  const [rawSelection, setSelection] = useState<StateSelection>(NO_SELECTION);
  const selection: StateSelection = useMemo(
    () => liveSelection(rawSelection, core.model),
    [rawSelection, core.model],
  );
  return [selection, setSelection];
}

/** The state editor's state: the shared core, the selection, inline renaming and its actions. */
export function useStateEditor(props: VisualEditorProps): StateEditorState {
  const core: EditorCore<StateModel> = useEditorCore({
    props,
    module: stateEditor,
    layout: STATE_LAYOUT,
  });
  const [selection, setSelection] = useStateSelection(core);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shouldFocusEdgeLabel, setFocusEdgeLabel] = useState<boolean>(false);
  useSelectionSync({ diagramId: props.diagramId, core, selection, setSelection });
  const context: StateActionContext = useActionContext(core, setSelection, setEditingId);
  const { screenToFlowPosition } = useReactFlow();
  const editing: Pick<
    StateEditorState,
    'editingId' | 'setEditingId' | 'shouldFocusEdgeLabel' | 'setFocusEdgeLabel'
  > = { editingId, setEditingId, shouldFocusEdgeLabel, setFocusEdgeLabel };
  return { core, selection, setSelection, ...editing, context, toCanvas: screenToFlowPosition };
}
