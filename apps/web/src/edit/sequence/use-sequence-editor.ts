import { computeLayout } from '@nautink/editors/sequence/layout';
import { sequenceEditor } from '@nautink/editors/sequence/model';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { NO_POSITION_STORE, SEQUENCE_LAYOUT } from './sequence-layout.ts';
import { liveSelection, selectedItems, selectionOfIds } from './sequence-selection.ts';
import { SequenceUiStore } from './sequence-ui-store.ts';
import { canvasTextMeasurer } from '../canvas/text-measurer.ts';
import {
  clearSelection,
  publishSelection,
  useSelectionRequests,
} from '../selection/canvas-selection.ts';
import { useEditorCore } from '../use-editor-core.ts';

import type { SequenceActionContext } from './sequence-actions.ts';
import type { EditTarget, SequenceSelection } from './sequence-types.ts';
import type { SequenceUi } from './sequence-ui-store.ts';
import type { VisualEditorProps } from '../editor-props.ts';
import type { EditorCore } from '../use-editor-core.ts';
import type { SequenceLayout } from '@nautink/editors/sequence/layout';
import type { SequenceModel } from '@nautink/editors/sequence/types';

export interface SequenceEditorState {
  core: EditorCore<SequenceModel>;
  /** The model's geometry; null until the first parse. */
  layout: SequenceLayout | null;
  /** The selection, minus anything an outside change removed. */
  selection: SequenceSelection;
  /** The text open in the inline field; never while read-only. */
  editing: EditTarget | null;
  context: SequenceActionContext;
}

/** Reports the selection to the app-wide store, and selects what Split's preview asks for. */
function useSelectionSync(
  diagramId: string,
  core: EditorCore<SequenceModel>,
  { store, selection }: { store: SequenceUiStore; selection: SequenceSelection },
): void {
  const { model, getModel } = core;
  useEffect(() => {
    publishSelection(diagramId, selectedItems(model, selection));
  }, [diagramId, model, selection]);
  useEffect(() => clearSelection, []);
  const select: (ids: readonly string[]) => void = useCallback(
    (ids: readonly string[]): void => {
      store.select(selectionOfIds(getModel(), ids));
    },
    [getModel, store],
  );
  useSelectionRequests(diagramId, select);
}

function useActionContext(
  core: EditorCore<SequenceModel>,
  store: SequenceUiStore,
): SequenceActionContext {
  const { getModel, commit, isReadOnly } = core;
  return useMemo(
    () => ({
      getModel,
      commit,
      isReadOnly: (): boolean => isReadOnly,
      getSelection: (): SequenceSelection =>
        liveSelection(store.getSnapshot().selection, getModel()),
      select: store.select,
      edit: store.edit,
    }),
    [getModel, commit, isReadOnly, store],
  );
}

function useLayout(model: SequenceModel | null): SequenceLayout | null {
  return useMemo(() => (model === null ? null : computeLayout(model, canvasTextMeasurer)), [model]);
}

/** The sequence editor's state: the shared core, the layout, the selection and its actions. */
export function useSequenceEditor(props: VisualEditorProps): SequenceEditorState {
  const core: EditorCore<SequenceModel> = useEditorCore({
    props,
    module: sequenceEditor,
    layout: SEQUENCE_LAYOUT,
    store: NO_POSITION_STORE,
  });
  const [store] = useState<SequenceUiStore>(() => new SequenceUiStore());
  const ui: SequenceUi = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const selection: SequenceSelection = useMemo(
    () => liveSelection(ui.selection, core.model),
    [ui.selection, core.model],
  );
  useSelectionSync(props.diagramId, core, { store, selection });
  const context: SequenceActionContext = useActionContext(core, store);
  const editing: EditTarget | null = core.isReadOnly ? null : ui.editing;
  return { core, layout: useLayout(core.model), selection, editing, context };
}
