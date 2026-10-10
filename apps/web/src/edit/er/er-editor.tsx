import { ReactFlowProvider } from '@xyflow/react';
import { useMemo, useRef } from 'react';

import { addEntity, renameFromHeader, setDirection, setRelLabel } from './er-actions.ts';
import { ErEditorContext } from './er-context.ts';
import { ErInspector } from './er-inspector.tsx';
import { handleErKey } from './er-keys.ts';
import { ErMarkers } from './er-markers.tsx';
import { ErToolbar } from './er-toolbar.tsx';
import { NO_SELECTION } from './er-types.ts';
import { useErEditor } from './use-er-editor.ts';
import { useErProps } from './use-er-props.ts';
import { CanvasHint } from '../canvas/canvas-notices.tsx';
import { EditorCanvas } from '../canvas/editor-canvas.tsx';
import { useFitNow } from '../canvas/use-canvas-fit.ts';
import { useWindowKeys } from '../canvas/use-window-keys.ts';
import { useSelectionPrompt } from '../selection-prompt/use-selection-prompt.ts';

import type { ErEditorContextValue } from './er-context.ts';
import type { ErEditorState } from './use-er-editor.ts';
import type { VisualEditorProps } from '../editor-props.ts';
import type { ErModel } from '@nautink/editors/er/model';
import type { ReactElement, RefObject } from 'react';

const HALF: number = 0.5;

/** Adds an entity at the middle of the visible canvas (a click on the toolbar). */
function useAddAtCenter(root: RefObject<HTMLDivElement | null>, state: ErEditorState): () => void {
  return (): void => {
    const box: DOMRect | undefined = root.current?.getBoundingClientRect();
    const middle: { x: number; y: number } = {
      x: (box?.left ?? 0) + (box?.width ?? 0) * HALF,
      y: (box?.top ?? 0) + (box?.height ?? 0) * HALF,
    };
    addEntity(state.context, { at: state.toCanvas(middle) });
  };
}

/** The canvas shortcuts (Enter, Esc, arrows, ⇧1) while the canvas has focus. */
function useErKeys(root: RefObject<HTMLDivElement | null>, state: ErEditorState): void {
  const fitNow: () => void = useFitNow();
  const { selection, core, setEditingId, setSelection } = state;
  useWindowKeys(root, (event: KeyboardEvent) =>
    handleErKey(event, {
      selection,
      isReadOnly: core.isReadOnly,
      setEditingId,
      setSelection,
      move: core.book.move,
      fit: fitNow,
    }),
  );
}

function useItemContext(state: ErEditorState): ErEditorContextValue {
  const { editingId, setEditingId, setSelection, context } = state;
  const isReadOnly: boolean = state.core.isReadOnly;
  return useMemo(
    () => ({
      editingId,
      setEditingId,
      isReadOnly,
      renameEntity: (name: string, text: string): void => {
        renameFromHeader(context, name, text);
      },
      setRelLabel: (id: string, label: string): void => {
        setRelLabel(context, id, label);
      },
      selectRel: (id: string): void => {
        setSelection({ ...NO_SELECTION, rels: [id] });
      },
    }),
    [editingId, setEditingId, isReadOnly, context, setSelection],
  );
}

function ErCanvas(props: VisualEditorProps): ReactElement {
  const rootRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  const state: ErEditorState = useErEditor(props);
  const { core, selection, context } = state;
  const addAtCenter: () => void = useAddAtCenter(rootRef, state);
  useErKeys(rootRef, state);
  // The ER editor cannot make a new group (as v1), so the floating prompt has no Group.
  useSelectionPrompt({ rootRef, isReadOnly: core.isReadOnly, group: null });
  const model: ErModel | null = core.model;
  return (
    <ErEditorContext.Provider value={useItemContext(state)}>
      <EditorCanvas
        flow={useErProps(state)}
        isDark={props.isDark}
        isReadOnly={core.isReadOnly}
        readOnlyReason={core.readOnlyReason}
        fitRequest={core.fitRequest}
        rootRef={rootRef}
      >
        <ErMarkers />
        <ErToolbar
          isReadOnly={core.isReadOnly}
          hasModel={model !== null}
          onAddEntity={addAtCenter}
          onAutoLayout={core.autoLayout}
          direction={model?.direction ?? null}
          onDirection={(direction) => {
            setDirection(context, direction);
          }}
        />
        {model === null ? null : (
          <ErInspector
            model={model}
            selection={selection}
            context={context}
            isReadOnly={core.isReadOnly}
          />
        )}
        {model !== null && model.entities.length === 0 && !core.isReadOnly ? (
          <CanvasHint text="Add an entity from the toolbar to start" />
        ) : null}
      </EditorCanvas>
    </ErEditorContext.Provider>
  );
}

/** The ER visual editor (v1's EREditor): entity tables, attributes and keys, crow's-foot relationships, groups and the inspector. */
export function ErEditor(props: VisualEditorProps): ReactElement {
  return (
    <ReactFlowProvider>
      <ErCanvas {...props} />
    </ReactFlowProvider>
  );
}
