import { useId, useRef, useState } from 'react';

import { toggleAutonumber } from './sequence-actions.ts';
import { addMessage, addNote, addParticipant, wrapSelection } from './sequence-add.ts';
import { SequenceDiagram } from './sequence-diagram.tsx';
import { dropOutcome, SEQUENCE_DRAG_TYPE } from './sequence-drop.ts';
import { InlineEditor } from './sequence-inline-editor.tsx';
import { SequenceInspector } from './sequence-inspector.tsx';
import { handleSequenceKey } from './sequence-keys.ts';
import { SequenceLibrary } from './sequence-library.tsx';
import { applyDropOutcome } from './sequence-outcomes.ts';
import { commitText } from './sequence-text.ts';
import { SequenceToolbar } from './sequence-toolbar.tsx';
import { stageTransform } from './sequence-view.ts';
import { useSequenceEditor } from './use-sequence-editor.ts';
import { useSequencePointer } from './use-sequence-pointer.ts';
import { useSequenceView } from './use-sequence-view.ts';
import { ZoomControls } from '../../preview/zoom-controls.tsx';
import { CanvasHint, ReadOnlyBanner } from '../canvas/canvas-notices.tsx';
import { useWindowKeys } from '../canvas/use-window-keys.ts';
import { useSelectionPrompt } from '../selection-prompt/use-selection-prompt.ts';

import type { DropOutcome } from './sequence-drop.ts';
import type { SequenceLibraryTab } from './sequence-library.tsx';
import type { CanvasHandlers, CanvasScene } from './sequence-scene.ts';
import type { SelectionKind, SequenceSelection } from './sequence-types.ts';
import type { SequenceEditorState } from './use-sequence-editor.ts';
import type { SequencePointer } from './use-sequence-pointer.ts';
import type { SequenceView } from './use-sequence-view.ts';
import type { Point } from '../../preview/view-math.ts';
import type { VisualEditorProps } from '../editor-props.ts';
import type { SequenceLayout } from '@nautink/editors/sequence/layout';
import type { DragEvent, ReactElement, RefObject } from 'react';

/** The view's state and commands, without the viewport's ref. */
type CanvasView = Omit<SequenceView, 'attachViewport'>;

interface StageProps {
  state: SequenceEditorState;
  view: CanvasView;
  pointer: SequencePointer;
  markerId: string;
}

/** Adds what was dropped from the toolbar or library where it was let go. */
function dropOn(
  { state, view }: Pick<StageProps, 'state' | 'view'>,
  event: DragEvent<HTMLDivElement>,
): void {
  const data: string = event.dataTransfer.getData(SEQUENCE_DRAG_TYPE);
  const { layout, core, context } = state;
  if (data === '' || layout === null || core.isReadOnly) {
    return;
  }
  event.preventDefault();
  const at: Point = view.toCanvas({ x: event.clientX, y: event.clientY });
  const outcome: DropOutcome | null = dropOutcome(data, at, layout);
  if (outcome !== null) {
    applyDropOutcome(context, outcome);
  }
}

/** The drawing at the view's pan and zoom, with the inline text field over it. */
function StageContent({
  layout,
  state,
  view,
  pointer,
  markerId,
}: StageProps & { layout: SequenceLayout }): ReactElement {
  const { core, context, selection, editing } = state;
  const scene: CanvasScene = {
    layout,
    selection,
    editing,
    preview: pointer.preview,
    isReadOnly: core.isReadOnly,
    markerId,
  };
  const handlers: CanvasHandlers = {
    ...pointer.handlers,
    onEdit: (target) => {
      if (!core.isReadOnly) {
        context.edit(target);
      }
    },
  };
  return (
    <div
      className="absolute top-0 left-0 origin-top-left"
      style={{ transform: stageTransform(view.view) }}
    >
      <SequenceDiagram scene={scene} handlers={handlers} />
      {editing === null ? null : (
        <InlineEditor
          layout={layout}
          target={editing}
          onCommit={(target, text) => {
            commitText(context, target, text);
          }}
          onCancel={() => {
            context.edit(null);
          }}
        />
      )}
    </div>
  );
}

/** The pannable, zoomable stage with the drawing and the inline text field (v1's `seq-scroll`). */
function SequenceStage({
  viewportRef,
  ...props
}: StageProps & { viewportRef: (element: HTMLDivElement | null) => void }): ReactElement {
  const { state, view, pointer, markerId } = props;
  const { layout } = state;
  return (
    <div
      ref={viewportRef}
      data-testid="sequence-canvas"
      className="absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
      onPointerDown={pointer.onBackgroundDown}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(SEQUENCE_DRAG_TYPE)) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        dropOn({ state, view }, event);
      }}
    >
      {layout === null ? null : (
        <StageContent
          layout={layout}
          state={state}
          view={view}
          pointer={pointer}
          markerId={markerId}
        />
      )}
    </div>
  );
}

function SequenceChrome({ state }: { state: SequenceEditorState }): ReactElement {
  const { core, context } = state;
  const [libraryTab, setLibraryTab] = useState<SequenceLibraryTab | null>(null);
  const model: SequenceEditorState['core']['model'] = core.model;
  return (
    <>
      <SequenceToolbar
        isReadOnly={core.isReadOnly}
        hasParticipants={(model?.participants.length ?? 0) > 0}
        isNumbered={model?.autonumber !== null && model?.autonumber !== undefined}
        isLibraryOpen={libraryTab !== null}
        onAddParticipant={(kind) => {
          addParticipant(context, kind);
        }}
        onAddMessage={() => {
          addMessage(context);
        }}
        onAddNote={() => {
          addNote(context);
        }}
        onToggleNumbers={() => {
          toggleAutonumber(context);
        }}
        onLibrary={() => {
          setLibraryTab(libraryTab === null ? 'participants' : null);
        }}
      />
      {libraryTab === null ? null : (
        <SequenceLibrary
          tab={libraryTab}
          onTabChange={setLibraryTab}
          onClose={() => {
            setLibraryTab(null);
          }}
          isReadOnly={core.isReadOnly}
          onAddParticipant={(kind) => {
            addParticipant(context, kind);
          }}
          onAddBlock={(kind) => {
            wrapSelection(context, kind);
          }}
        />
      )}
      {model === null ? null : (
        <SequenceInspector
          model={model}
          selection={state.selection}
          context={context}
          isReadOnly={core.isReadOnly}
        />
      )}
    </>
  );
}

/** v1's quiet hints: what to add first, then how to draw a message. */
function SequenceHints({ state }: { state: SequenceEditorState }): ReactElement | null {
  const { model, isReadOnly } = state.core;
  if (model === null || isReadOnly) {
    return null;
  }
  if (model.participants.length === 0) {
    return <CanvasHint text="Add a participant or actor from the toolbar to start" />;
  }
  return model.items.length === 0 ? (
    <p className="pointer-events-none absolute inset-x-0 bottom-28 text-center text-muted-foreground">
      Drag from one lifeline to another to add a message
    </p>
  ) : null;
}

/** The test id each selected thing is drawn with: a participant's header, a box, a row. */
const SELECTED_TEST_ID: Readonly<Record<SelectionKind, string>> = {
  participant: 'sequence-participant-',
  box: 'sequence-box-',
  items: 'sequence-item-',
};

/** The drawn elements of the selection, for the floating selection prompt's position. */
function selectedElements(root: HTMLElement, selection: SequenceSelection): Element[] {
  const prefix: string | null = selection.kind === null ? null : SELECTED_TEST_ID[selection.kind];
  const ids: Set<string> = new Set<string>(selection.ids.map((id) => `${prefix ?? ''}${id}`));
  return [...root.querySelectorAll('[data-testid]')].filter(
    (element) => prefix !== null && ids.has(element.getAttribute('data-testid') ?? ''),
  );
}

/** Rows and participant headers: the prompt keeps off the ones that are not selected. */
function shapeElements(root: HTMLElement): Element[] {
  return [
    ...root.querySelectorAll(
      '[data-testid^="sequence-item-"], [data-testid^="sequence-participant-"]',
    ),
  ];
}

function SequenceCanvas(props: VisualEditorProps): ReactElement {
  const rootRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement>(null);
  const markerId: string = `sequence${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const state: SequenceEditorState = useSequenceEditor(props);
  const { attachViewport, ...view }: SequenceView = useSequenceView(
    state.layout,
    state.core.fitRequest,
  );
  const pointer: SequencePointer = useSequencePointer({
    view,
    layout: state.layout,
    context: state.context,
  });
  // Sequence rows have no group of the M1 kind (blocks are added from the library), so no Group.
  useSelectionPrompt({
    rootRef,
    isReadOnly: state.core.isReadOnly,
    group: null,
    selectedElements: (root) => selectedElements(root, state.selection),
    shapeElements,
  });
  useWindowKeys(rootRef, (event: KeyboardEvent) =>
    handleSequenceKey(event, {
      context: state.context,
      isReadOnly: state.core.isReadOnly,
      fit: view.fit,
    }),
  );
  return (
    <div ref={rootRef} className="@container absolute inset-0 overflow-hidden">
      <SequenceStage
        viewportRef={attachViewport}
        state={state}
        view={view}
        pointer={pointer}
        markerId={markerId}
      />
      <SequenceHints state={state} />
      <SequenceChrome state={state} />
      <ZoomControls
        controller={{ zoomBy: view.zoomBy, fit: view.fit }}
        zoom={view.view.k}
        fitShortcut="⇧1"
      />
      <ReadOnlyBanner reason={state.core.readOnlyReason} />
    </div>
  );
}

/**
 * The sequence diagram visual editor (v1's SequenceEditor): participants and boxes, messages,
 * notes, blocks and autonumber on one SVG laid out from the model. No React Flow and no saved
 * positions: the order of participants and rows is the layout.
 */
export function SequenceEditor(props: VisualEditorProps): ReactElement {
  return <SequenceCanvas {...props} />;
}
