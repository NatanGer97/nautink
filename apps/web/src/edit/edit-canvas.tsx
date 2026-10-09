import { Suspense, createElement, useCallback } from 'react';

import { viewAvailability } from './canvas-views.ts';
import { CenteredNotice, EmptyDiagramNotice, NoEditorNotice } from './edit-notices.tsx';
import { VISUAL_EDITORS, editorIdFor } from './editor-registry.ts';
import { readOnlyReason } from './read-only-reason.ts';
import { useChatStore } from '../chat/chat-store.ts';
import { useViewedVersion } from '../history/viewed-version.ts';
import { useIsDarkTheme } from '../lib/use-is-dark-theme.ts';
import { useFocusModeEscape } from '../preview/focus-mode.ts';
import { ViewedVersionBar } from '../preview/viewed-version-bar.tsx';
import { useActiveDiagram, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { LazyVisualEditor } from './editor-registry.ts';
import type { Diagram, Version } from '@nautink/storage/records';
import type { EditorId } from '@nautink/visual-core/editor-contract';
import type { ReactElement } from 'react';

interface EditorHostProps {
  editor: LazyVisualEditor;
  diagram: Diagram;
  viewed: Version | null;
}

/** Hands the editor its props: the code, the history as `onChange`, and why it is read-only. */
function EditorHost({ editor, diagram, viewed }: EditorHostProps): ReactElement {
  const isDark: boolean = useIsDarkTheme();
  const isClaudeEditing: boolean = useChatStore((state) => state.busyDiagramId === diagram.id);
  const diagramId: string = diagram.id;
  const isViewingVersion: boolean = viewed !== null;
  const onChange: (code: string, label: string) => void = useCallback(
    (code: string, label: string): void => {
      if (!isViewingVersion) {
        useWorkspaceStore.getState().applyEdit(code, { label, source: 'visual', diagramId });
      }
    },
    [diagramId, isViewingVersion],
  );
  return (
    <Suspense fallback={<CenteredNotice message="Loading the editor…">{null}</CenteredNotice>}>
      {createElement(editor, {
        diagramId,
        code: viewed?.code ?? diagram.code,
        isDark,
        readOnlyReason: readOnlyReason({ isClaudeEditing, isViewingVersion }),
        canSavePositions: !isViewingVersion,
        onChange,
      })}
    </Suspense>
  );
}

function EditBody({ diagram, viewed }: { diagram: Diagram; viewed: Version | null }): ReactElement {
  const code: string = viewed?.code ?? diagram.code;
  const editorId: EditorId | null = editorIdFor(code);
  const editor: LazyVisualEditor | undefined =
    editorId === null ? undefined : VISUAL_EDITORS[editorId];
  if (editorId === null || editor === undefined) {
    return viewAvailability(code).isEmpty ? (
      <EmptyDiagramNotice />
    ) : (
      <NoEditorNotice diagramId={diagram.id} code={code} />
    );
  }
  return (
    <EditorHost
      // A new diagram, version or diagram type starts a fresh editor: its positions and model.
      key={`${diagram.id}:${viewed?.id ?? ''}:${editorId}`}
      {...{ editor, diagram, viewed }}
    />
  );
}

export interface EditCanvasProps {
  /** In Split the preview half already shows the viewed-version bar. */
  isSplit: boolean;
}

/** The canvas in Edit mode (lazy chunk): the open diagram's visual editor, or why there is none. */
export function EditCanvas({ isSplit }: EditCanvasProps): ReactElement {
  const diagram: Diagram | undefined = useActiveDiagram();
  const viewed: Version | null = useViewedVersion();
  useFocusModeEscape();
  if (diagram === undefined) {
    return (
      <div className="grid h-full place-items-center p-6 text-muted-foreground">
        Opening your diagrams…
      </div>
    );
  }
  return (
    <div className="absolute inset-0">
      <EditBody diagram={diagram} viewed={viewed} />
      {viewed !== null && !isSplit ? (
        <ViewedVersionBar version={viewed} currentCode={diagram.code} />
      ) : null}
    </div>
  );
}
