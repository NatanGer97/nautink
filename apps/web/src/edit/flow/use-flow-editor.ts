import { flowEditor } from '@nautink/editors/flow/model';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { FLOW_LAYOUT } from './flow-layout.ts';
import { liveSelection, selectedItems, selectionOfIds } from './flow-selection.ts';
import { NO_SELECTION } from './flow-types.ts';
import {
  clearSelection,
  publishSelection,
  useSelectionRequests,
} from '../selection/canvas-selection.ts';
import { useEditorCore } from '../use-editor-core.ts';

import type { FlowActionContext } from './flow-actions.ts';
import type { FlowSelection } from './flow-types.ts';
import type { VisualEditorProps } from '../editor-props.ts';
import type { EditorCore } from '../use-editor-core.ts';
import type { FlowGraph } from '@nautink/editors/flow/model';
import type { Point } from '@nautink/visual-core/geometry';
import type { Dispatch, SetStateAction } from 'react';

export interface FlowEditorState {
  core: EditorCore<FlowGraph>;
  /** The selection, minus anything an outside change removed. */
  selection: FlowSelection;
  setSelection: Dispatch<SetStateAction<FlowSelection>>;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  shouldFocusEdgeLabel: boolean;
  setFocusEdgeLabel: (isFocused: boolean) => void;
  context: FlowActionContext;
  toCanvas: (point: Point) => Point;
}

interface SelectionSync {
  diagramId: string;
  core: EditorCore<FlowGraph>;
  selection: FlowSelection;
  setSelection: Dispatch<SetStateAction<FlowSelection>>;
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
  core: EditorCore<FlowGraph>,
  setSelection: Dispatch<SetStateAction<FlowSelection>>,
  setEditingId: (id: string | null) => void,
): FlowActionContext {
  const { getModel, commit, book, requestFit } = core;
  return useMemo(
    () => ({
      getGraph: getModel,
      commit,
      positions: book,
      select: setSelection,
      setEditingId,
      requestFit,
    }),
    [getModel, commit, book, setSelection, setEditingId, requestFit],
  );
}

function useFlowSelection(
  core: EditorCore<FlowGraph>,
): [FlowSelection, Dispatch<SetStateAction<FlowSelection>>] {
  const [rawSelection, setSelection] = useState<FlowSelection>(NO_SELECTION);
  const selection: FlowSelection = useMemo(
    () => liveSelection(rawSelection, core.model),
    [rawSelection, core.model],
  );
  return [selection, setSelection];
}

/** The flowchart editor's state: the shared core, the selection, inline renaming and its actions. */
export function useFlowEditor(props: VisualEditorProps): FlowEditorState {
  const core: EditorCore<FlowGraph> = useEditorCore({
    props,
    module: flowEditor,
    layout: FLOW_LAYOUT,
  });
  const [selection, setSelection] = useFlowSelection(core);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shouldFocusEdgeLabel, setFocusEdgeLabel] = useState<boolean>(false);
  useSelectionSync({ diagramId: props.diagramId, core, selection, setSelection });
  const context: FlowActionContext = useActionContext(core, setSelection, setEditingId);
  const { screenToFlowPosition } = useReactFlow();
  const editing: Pick<
    FlowEditorState,
    'editingId' | 'setEditingId' | 'shouldFocusEdgeLabel' | 'setFocusEdgeLabel'
  > = { editingId, setEditingId, shouldFocusEdgeLabel, setFocusEdgeLabel };
  return { core, selection, setSelection, ...editing, context, toCanvas: screenToFlowPosition };
}
