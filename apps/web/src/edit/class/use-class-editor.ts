import { classEditor } from '@nautink/editors/class/model';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { CLASS_LAYOUT } from './class-layout.ts';
import { liveSelection, selectedItems, selectionOfIds } from './class-selection.ts';
import { NO_SELECTION } from './class-types.ts';
import {
  clearSelection,
  publishSelection,
  useSelectionRequests,
} from '../selection/canvas-selection.ts';
import { useEditorCore } from '../use-editor-core.ts';

import type { ClassActionContext } from './class-action-context.ts';
import type { ClassEditing, ClassSelection } from './class-types.ts';
import type { VisualEditorProps } from '../editor-props.ts';
import type { EditorCore } from '../use-editor-core.ts';
import type { ClassModel } from '@nautink/editors/class/types';
import type { Point } from '@nautink/visual-core/geometry';
import type { Dispatch, SetStateAction } from 'react';

export interface ClassEditorState {
  core: EditorCore<ClassModel>;
  /** The selection, minus anything an outside change removed. */
  selection: ClassSelection;
  setSelection: Dispatch<SetStateAction<ClassSelection>>;
  editing: ClassEditing | null;
  setEditing: (editing: ClassEditing | null) => void;
  shouldFocusEdgeLabel: boolean;
  setFocusEdgeLabel: (isFocused: boolean) => void;
  /** The toolbar's kind for new links (association by default, v1). */
  relationKind: string;
  setRelationKind: (kind: string) => void;
  context: ClassActionContext;
  toCanvas: (point: Point) => Point;
}

interface SelectionSync {
  diagramId: string;
  core: EditorCore<ClassModel>;
  selection: ClassSelection;
  setSelection: Dispatch<SetStateAction<ClassSelection>>;
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
  core: EditorCore<ClassModel>,
  setSelection: Dispatch<SetStateAction<ClassSelection>>,
  setEditing: (editing: ClassEditing | null) => void,
): ClassActionContext {
  const { getModel, commit, book, requestFit } = core;
  return useMemo(
    () => ({ getModel, commit, positions: book, select: setSelection, setEditing, requestFit }),
    [getModel, commit, book, setSelection, setEditing, requestFit],
  );
}

function useClassSelection(
  core: EditorCore<ClassModel>,
): [ClassSelection, Dispatch<SetStateAction<ClassSelection>>] {
  const [rawSelection, setSelection] = useState<ClassSelection>(NO_SELECTION);
  const selection: ClassSelection = useMemo(
    () => liveSelection(rawSelection, core.model),
    [rawSelection, core.model],
  );
  return [selection, setSelection];
}

/** The class editor's state: the shared core, the selection, in-place editing and its actions. */
export function useClassEditor(props: VisualEditorProps): ClassEditorState {
  const core: EditorCore<ClassModel> = useEditorCore({
    props,
    module: classEditor,
    layout: CLASS_LAYOUT,
  });
  const [selection, setSelection] = useClassSelection(core);
  const [editing, setEditing] = useState<ClassEditing | null>(null);
  const [shouldFocusEdgeLabel, setFocusEdgeLabel] = useState<boolean>(false);
  const [relationKind, setRelationKind] = useState<string>('association');
  useSelectionSync({ diagramId: props.diagramId, core, selection, setSelection });
  const context: ClassActionContext = useActionContext(core, setSelection, setEditing);
  const { screenToFlowPosition } = useReactFlow();
  return {
    ...{ core, selection, setSelection, editing, setEditing, context },
    ...{ shouldFocusEdgeLabel, setFocusEdgeLabel, relationKind, setRelationKind },
    toCanvas: screenToFlowPosition,
  };
}
