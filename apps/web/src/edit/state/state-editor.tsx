import { ReactFlowProvider } from '@xyflow/react';
import { useMemo, useRef } from 'react';

import { renameInline, setDirection } from './state-actions.ts';
import { addItem, toolbarSpot } from './state-add.ts';
import { StateEditorContext } from './state-context.ts';
import { StateInspector } from './state-inspector.tsx';
import { handleStateKey } from './state-keys.ts';
import { StateToolbar } from './state-toolbar.tsx';
import { useStateEditor } from './use-state-editor.ts';
import { useStateProps } from './use-state-props.ts';
import { CanvasHint } from '../canvas/canvas-notices.tsx';
import { EditorCanvas } from '../canvas/editor-canvas.tsx';
import { useFitNow } from '../canvas/use-canvas-fit.ts';
import { useWindowKeys } from '../canvas/use-window-keys.ts';

import type { Spot } from './state-add.ts';
import type { StateEditorContextValue } from './state-context.ts';
import type { PaletteKind } from './state-types.ts';
import type { StateEditorState } from './use-state-editor.ts';
import type { VisualEditorProps } from '../editor-props.ts';
import type { StateModel } from '@nautink/editors/state/types';
import type { Point } from '@nautink/visual-core/geometry';
import type { ReactElement, RefObject } from 'react';

const HALF: number = 0.5;

/** The middle of the canvas on screen, in canvas coordinates. */
function viewMiddle(root: HTMLDivElement | null, toCanvas: (point: Point) => Point): Point {
  const box: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> = root?.getBoundingClientRect() ?? {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  };
  return toCanvas({ x: box.left + box.width * HALF, y: box.top + box.height * HALF });
}

/** Adds a toolbar item: inside the selected composite, else at the middle of the view (v1). */
function useAddFromToolbar(
  root: RefObject<HTMLDivElement | null>,
  state: StateEditorState,
): (kind: PaletteKind) => void {
  return (kind: PaletteKind): void => {
    const middle: Point = viewMiddle(root.current, state.toCanvas);
    const { context, selection } = state;
    const spot: Spot =
      kind === 'note' ? { at: middle, scope: null } : toolbarSpot(context, selection, middle);
    addItem(context, { kind, spot, selection, isDropped: false });
  };
}

/** The canvas shortcuts (Enter, Esc, arrows, ⇧1) while the canvas has focus. */
function useStateKeys(root: RefObject<HTMLDivElement | null>, state: StateEditorState): void {
  const fitNow: () => void = useFitNow();
  const { selection, context, core, setEditingId, setSelection } = state;
  useWindowKeys(root, (event: KeyboardEvent) =>
    handleStateKey(event, {
      selection,
      context,
      isReadOnly: core.isReadOnly,
      setEditingId,
      setSelection,
      fit: fitNow,
    }),
  );
}

function useNodeContext(state: StateEditorState): StateEditorContextValue {
  const { editingId, setEditingId, context } = state;
  const isReadOnly: boolean = state.core.isReadOnly;
  return useMemo(
    () => ({
      editingId,
      setEditingId,
      isReadOnly,
      rename: (id: string, text: string): void => {
        renameInline(context, id, text);
      },
    }),
    [editingId, setEditingId, isReadOnly, context],
  );
}

function isEmptyModel(model: StateModel): boolean {
  return model.states.length === 0 && model.transitions.length === 0 && model.pseudo.length === 0;
}

function StateCanvas(props: VisualEditorProps): ReactElement {
  const rootRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  const state: StateEditorState = useStateEditor(props);
  const { core, selection, context } = state;
  const onAdd: (kind: PaletteKind) => void = useAddFromToolbar(rootRef, state);
  useStateKeys(rootRef, state);
  const model: StateModel | null = core.model;
  return (
    <StateEditorContext.Provider value={useNodeContext(state)}>
      <EditorCanvas
        flow={useStateProps(state)}
        isDark={props.isDark}
        isReadOnly={core.isReadOnly}
        readOnlyReason={core.readOnlyReason}
        fitRequest={core.fitRequest}
        rootRef={rootRef}
      >
        <StateToolbar
          isReadOnly={core.isReadOnly}
          onAdd={onAdd}
          onAutoLayout={core.autoLayout}
          direction={model?.direction ?? null}
          onDirection={(direction) => {
            setDirection(context, direction);
          }}
        />
        {model === null ? null : (
          <StateInspector
            model={model}
            selection={selection}
            context={context}
            isReadOnly={core.isReadOnly}
            shouldFocusEdgeLabel={state.shouldFocusEdgeLabel}
          />
        )}
        {model !== null && isEmptyModel(model) && !core.isReadOnly ? (
          <CanvasHint text="Add a state from the toolbar to start" />
        ) : null}
      </EditorCanvas>
    </StateEditorContext.Provider>
  );
}

/**
 * The state diagram visual editor (v1's StateEditor): states, [*], choice, fork and join,
 * composites with concurrent regions, notes, transitions and the inspector.
 */
export function StateEditor(props: VisualEditorProps): ReactElement {
  return (
    <ReactFlowProvider>
      <StateCanvas {...props} />
    </ReactFlowProvider>
  );
}
