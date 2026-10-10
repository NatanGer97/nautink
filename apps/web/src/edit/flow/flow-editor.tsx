import { ReactFlowProvider } from '@xyflow/react';
import { useMemo, useRef, useState } from 'react';

import { addShape, renameNode, setDirection } from './flow-actions.ts';
import { FlowEditorContext } from './flow-context.ts';
import { FlowInspector } from './flow-inspector.tsx';
import { handleFlowKey } from './flow-keys.ts';
import { FlowLibrary } from './flow-library.tsx';
import { FlowMarkers } from './flow-markers.tsx';
import { FlowToolbar } from './flow-toolbar.tsx';
import { useFlowEditor } from './use-flow-editor.ts';
import { useFlowProps } from './use-flow-props.ts';
import { useUiStore } from '../../state/ui-store.ts';
import { CanvasHint } from '../canvas/canvas-notices.tsx';
import { EditorCanvas } from '../canvas/editor-canvas.tsx';
import { useFitNow } from '../canvas/use-canvas-fit.ts';
import { useWindowKeys } from '../canvas/use-window-keys.ts';

import type { NewShape } from './flow-actions.ts';
import type { FlowEditorContextValue } from './flow-context.ts';
import type { FlowLibraryTab } from './flow-library.tsx';
import type { FlowEditorState } from './use-flow-editor.ts';
import type { VisualEditorProps } from '../editor-props.ts';
import type { FlowGraph } from '@nautink/editors/flow/model';
import type { ReactElement, RefObject } from 'react';

const HALF: number = 0.5;

/** The open library tab; whether the library is open is remembered across reloads (v1). */
function useLibraryTab(): [FlowLibraryTab | null, (tab: FlowLibraryTab | null) => void] {
  const isOpen: boolean = useUiStore((ui) => ui.isLibraryOpen);
  const setOpen: (isOpen: boolean) => void = useUiStore((ui) => ui.setLibraryOpen);
  const [tab, setTab] = useState<FlowLibraryTab>('shapes');
  const show = (next: FlowLibraryTab | null): void => {
    if (next !== null) {
      setTab(next);
    }
    setOpen(next !== null);
  };
  return [isOpen ? tab : null, show];
}

/** Adds a shape at the middle of the visible canvas (a click on the toolbar or a library tile). */
function useAddAtCenter(
  root: RefObject<HTMLDivElement | null>,
  state: FlowEditorState,
): (spec: NewShape) => void {
  return (spec: NewShape): void => {
    const box: DOMRect | undefined = root.current?.getBoundingClientRect();
    const middle: { x: number; y: number } = {
      x: (box?.left ?? 0) + (box?.width ?? 0) * HALF,
      y: (box?.top ?? 0) + (box?.height ?? 0) * HALF,
    };
    addShape(state.context, { spec, at: state.toCanvas(middle) });
  };
}

/** The canvas shortcuts (Enter, Esc, ⌘D, arrows, ⇧1) while the canvas has focus. */
function useFlowKeys(root: RefObject<HTMLDivElement | null>, state: FlowEditorState): void {
  const fitNow: () => void = useFitNow();
  const { selection, context, core, setEditingId, setSelection } = state;
  useWindowKeys(root, (event: KeyboardEvent) =>
    handleFlowKey(event, {
      selection,
      context,
      isReadOnly: core.isReadOnly,
      setEditingId,
      setSelection,
      move: core.book.move,
      fit: fitNow,
    }),
  );
}

function useNodeContext(state: FlowEditorState): FlowEditorContextValue {
  const { editingId, setEditingId, context } = state;
  const isReadOnly: boolean = state.core.isReadOnly;
  return useMemo(
    () => ({
      editingId,
      setEditingId,
      isReadOnly,
      renameNode: (id: string, label: string): void => {
        renameNode(context, id, label);
      },
    }),
    [editingId, setEditingId, isReadOnly, context],
  );
}

function FlowCanvas(props: VisualEditorProps): ReactElement {
  const rootRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  const state: FlowEditorState = useFlowEditor(props);
  const { core, selection, context } = state;
  const [libraryTab, setLibraryTab] = useLibraryTab();
  const addAtCenter: (spec: NewShape) => void = useAddAtCenter(rootRef, state);
  useFlowKeys(rootRef, state);
  const graph: FlowGraph | null = core.model;
  return (
    <FlowEditorContext.Provider value={useNodeContext(state)}>
      <EditorCanvas
        flow={useFlowProps(state)}
        isDark={props.isDark}
        isReadOnly={core.isReadOnly}
        readOnlyReason={core.readOnlyReason}
        fitRequest={core.fitRequest}
        rootRef={rootRef}
      >
        <FlowMarkers />
        <FlowToolbar
          isReadOnly={core.isReadOnly}
          hasGraph={graph !== null}
          libraryTab={libraryTab}
          onAdd={addAtCenter}
          onLibrary={setLibraryTab}
          onAutoLayout={core.autoLayout}
          direction={graph?.direction ?? null}
          onDirection={(direction) => {
            setDirection(context, direction);
          }}
        />
        {libraryTab === null ? null : (
          <FlowLibrary
            tab={libraryTab}
            onTabChange={setLibraryTab}
            onClose={() => {
              setLibraryTab(null);
            }}
            isReadOnly={core.isReadOnly}
            onAdd={addAtCenter}
          />
        )}
        {graph === null ? null : (
          <FlowInspector
            graph={graph}
            selection={selection}
            context={context}
            isReadOnly={core.isReadOnly}
            shouldFocusEdgeLabel={state.shouldFocusEdgeLabel}
          />
        )}
        {graph !== null && graph.nodes.length === 0 && !core.isReadOnly ? (
          <CanvasHint text="Add a shape from the toolbar or the library to start" />
        ) : null}
      </EditorCanvas>
    </FlowEditorContext.Provider>
  );
}

/** The flowchart visual editor (v1's FlowEditor): 53 shapes, icons, links, groups and the inspector. */
export function FlowEditor(props: VisualEditorProps): ReactElement {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
