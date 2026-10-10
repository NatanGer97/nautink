import { ReactFlowProvider } from '@xyflow/react';
import { useMemo, useRef } from 'react';

import { addItem } from './class-actions.ts';
import { ClassNodeContext } from './class-context.ts';
import { ClassInspector } from './class-inspector.tsx';
import { renameFromCanvas, setDirection } from './class-item-actions.ts';
import { handleClassKey } from './class-keys.ts';
import { ClassMarkers } from './class-markers.tsx';
import { setMemberText } from './class-member-actions.ts';
import { itemKind } from './class-names.ts';
import { groupInNamespace } from './class-namespace-actions.ts';
import { setNoteText } from './class-note-actions.ts';
import { ClassToolbar } from './class-toolbar.tsx';
import { useClassEditor } from './use-class-editor.ts';
import { useClassProps } from './use-class-props.ts';
import { CanvasHint } from '../canvas/canvas-notices.tsx';
import { EditorCanvas } from '../canvas/editor-canvas.tsx';
import { useFitNow } from '../canvas/use-canvas-fit.ts';
import { useWindowKeys } from '../canvas/use-window-keys.ts';
import { useSelectionPrompt } from '../selection-prompt/use-selection-prompt.ts';

import type { ClassNodeContextValue } from './class-context.ts';
import type { PaletteKind } from './class-palette.ts';
import type { ClassEditorState } from './use-class-editor.ts';
import type { VisualEditorProps } from '../editor-props.ts';
import type { ClassModel } from '@nautink/editors/class/types';
import type { ReactElement, RefObject } from 'react';

const HALF: number = 0.5;

/** Adds an item at the middle of the visible canvas (a click on a toolbar tile). */
function useAddAtCenter(
  root: RefObject<HTMLDivElement | null>,
  state: ClassEditorState,
): (kind: PaletteKind) => void {
  return (kind: PaletteKind): void => {
    const box: DOMRect | undefined = root.current?.getBoundingClientRect();
    const middle: { x: number; y: number } = {
      x: (box?.left ?? 0) + (box?.width ?? 0) * HALF,
      y: (box?.top ?? 0) + (box?.height ?? 0) * HALF,
    };
    addItem(state.context, {
      kind,
      at: state.toCanvas(middle),
      selection: state.selection,
      relationKind: state.relationKind,
    });
  };
}

/** The canvas shortcuts (Enter, Esc, ⌘D, arrows, ⇧1) while the canvas has focus. */
function useClassKeys(root: RefObject<HTMLDivElement | null>, state: ClassEditorState): void {
  const fitNow: () => void = useFitNow();
  const { selection, context, core, setEditing, setSelection } = state;
  useWindowKeys(root, (event: KeyboardEvent) =>
    handleClassKey(event, {
      selection,
      context,
      isReadOnly: core.isReadOnly,
      setEditing,
      setSelection,
      move: core.book.move,
      fit: fitNow,
    }),
  );
}

function useNodeContext(state: ClassEditorState): ClassNodeContextValue {
  const { editing, setEditing, context } = state;
  const isReadOnly: boolean = state.core.isReadOnly;
  return useMemo(
    () => ({
      editing,
      setEditing,
      isReadOnly,
      renameClass: (id: string, text: string): void => {
        renameFromCanvas(context, id, text);
      },
      setMemberText: (ref): void => {
        setMemberText(context, ref);
      },
      setNoteText: (id: string, text: string): void => {
        setNoteText(context, id, text);
      },
    }),
    [editing, setEditing, isReadOnly, context],
  );
}

/** The floating selection prompt: its Group puts the selected classes in a new namespace. */
function useClassSelectionPrompt(
  root: RefObject<HTMLDivElement | null>,
  state: ClassEditorState,
): void {
  const { selection, context, core } = state;
  const model: ClassModel | null = core.model;
  const hasClass: boolean =
    model !== null && selection.nodes.some((id) => itemKind(model, id) === 'class');
  useSelectionPrompt({
    rootRef: root,
    isReadOnly: core.isReadOnly,
    group: hasClass
      ? (): void => {
          groupInNamespace(context, selection.nodes);
        }
      : null,
  });
}

function isEmpty(model: ClassModel): boolean {
  return model.classes.length === 0 && model.notes.length === 0;
}

function ClassCanvas(props: VisualEditorProps): ReactElement {
  const rootRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  const state: ClassEditorState = useClassEditor(props);
  const { core, selection, context } = state;
  const addAtCenter: (kind: PaletteKind) => void = useAddAtCenter(rootRef, state);
  useClassKeys(rootRef, state);
  useClassSelectionPrompt(rootRef, state);
  const model: ClassModel | null = core.model;
  return (
    <ClassNodeContext.Provider value={useNodeContext(state)}>
      <EditorCanvas
        flow={useClassProps(state)}
        isDark={props.isDark}
        isReadOnly={core.isReadOnly}
        readOnlyReason={core.readOnlyReason}
        fitRequest={core.fitRequest}
        rootRef={rootRef}
      >
        <ClassMarkers />
        <ClassToolbar
          isReadOnly={core.isReadOnly}
          hasModel={model !== null}
          onAdd={addAtCenter}
          relationKind={state.relationKind}
          onRelationKind={state.setRelationKind}
          onAutoLayout={core.autoLayout}
          direction={model?.direction ?? null}
          onDirection={(direction) => {
            setDirection(context, direction);
          }}
        />
        {model === null ? null : (
          <ClassInspector
            model={model}
            selection={selection}
            context={context}
            isReadOnly={core.isReadOnly}
            shouldFocusEdgeLabel={state.shouldFocusEdgeLabel}
          />
        )}
        {model !== null && isEmpty(model) && !core.isReadOnly ? (
          <CanvasHint text="Add a class from the toolbar to start" />
        ) : null}
      </EditorCanvas>
    </ClassNodeContext.Provider>
  );
}

/** The UML class visual editor (v1's ClassEditor): classes, members, relations, notes, namespaces. */
export function ClassEditor(props: VisualEditorProps): ReactElement {
  return (
    <ReactFlowProvider>
      <ClassCanvas {...props} />
    </ReactFlowProvider>
  );
}
