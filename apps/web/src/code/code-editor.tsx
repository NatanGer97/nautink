import { Button } from '@nautink/ui/components/button';
import { useRef } from 'react';

import { askClaudeToFix } from './ask-claude-to-fix.ts';
import { useRevealRequests } from './code-reveal.ts';
import { useCursorPosition } from './use-cursor-position.ts';
import { useEditRecording } from './use-edit-recording.ts';
import { useEditorReadOnly } from './use-editor-read-only.ts';
import { useErrorMarkers } from './use-error-markers.ts';
import { useDiagramModel, useDisposeDeletedModels } from './use-model-sync.ts';
import { useEditorTheme, useMonacoEditor } from './use-monaco-editor.ts';
import { useIsDarkTheme } from '../lib/use-is-dark-theme.ts';
import { parseErrorTitle } from '../preview/parse-error-notice.tsx';
import { usePreviewStatus } from '../preview/preview-status.ts';
import { APP_HISTORY_ATTRIBUTE } from '../workspace/history-shortcuts.ts';

import type { CursorPosition } from './use-cursor-position.ts';
import type { EditorHandle, EditorLoad } from './use-monaco-editor.ts';
import type { PreviewStatus } from '../preview/preview-status.ts';
import type { ReactElement, RefObject } from 'react';

export interface CodeEditorProps {
  diagramId: string;
  code: string;
  /** Why the code cannot be edited right now ("Claude is editing…"), or null when it can. */
  readOnlyReason?: string | null;
}

interface FooterProps {
  diagramId: string;
  cursor: CursorPosition;
}

/** Under the editor: the parse error with "Ask Claude to fix", or a hint; and the cursor (M3). */
function CodeFooter({ diagramId, cursor }: FooterProps): ReactElement {
  const status: PreviewStatus = usePreviewStatus();
  const error: PreviewStatus['error'] = status.diagramId === diagramId ? status.error : null;
  return (
    <div className="flex min-h-9 shrink-0 items-center justify-between gap-3 border-t border-border-subtle px-3.5 py-1.5 text-xs text-faint">
      {error === null ? (
        <span className="truncate">Click a shape on the canvas to find its line</span>
      ) : (
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-destructive" />
          <span className="truncate text-destructive">{parseErrorTitle(error)}</span>
          <Button
            variant="outline"
            size="xs"
            className="shrink-0"
            onClick={() => {
              askClaudeToFix(error);
            }}
          >
            Ask Claude to fix
          </Button>
        </span>
      )}
      <span className="shrink-0 font-mono tabular-nums">
        {`Ln ${String(cursor.line)}, Col ${String(cursor.column)}`}
      </span>
    </div>
  );
}

/** "Loading the code editor…", or why it failed; nothing once the editor is up. */
function LoadNotice({ load }: { load: EditorLoad }): ReactElement | null {
  if (load.status === 'ready') {
    return null;
  }
  const isError: boolean = load.status === 'error';
  return (
    <p
      role={isError ? 'alert' : 'status'}
      className="absolute inset-x-0 top-0 px-3.5 py-2.5 text-muted-foreground"
    >
      {load.status === 'error' ? load.message : 'Loading the code editor…'}
    </p>
  );
}

function useEditorBindings(
  handle: EditorHandle | null,
  { diagramId, code, readOnlyReason = null }: CodeEditorProps,
): void {
  useEditorTheme(handle, useIsDarkTheme());
  useEditorReadOnly(handle, readOnlyReason);
  useDiagramModel(handle, diagramId, code);
  useEditRecording(handle);
  useErrorMarkers(handle, diagramId);
  useDisposeDeletedModels(handle);
  useRevealRequests(handle, diagramId);
}

/**
 * The Monaco editor for the open diagram (PRD §3.2). Monaco loads when this first mounts. ⌘Z inside
 * it runs the app's history (`data-edit-history="app"`), never Monaco's own undo.
 */
export function CodeEditor(props: CodeEditorProps): ReactElement {
  const containerRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null);
  const load: EditorLoad = useMonacoEditor(containerRef);
  const handle: EditorHandle | null = load.status === 'ready' ? load.handle : null;
  const cursor: CursorPosition = useCursorPosition(handle);
  useEditorBindings(handle, props);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {props.readOnlyReason ? (
        <p
          role="status"
          className="shrink-0 border-b border-border-subtle bg-subtle px-3.5 py-1.5 text-xs text-muted-foreground"
        >
          {props.readOnlyReason}
        </p>
      ) : null}
      <div className="relative min-h-0 flex-1">
        <div
          ref={containerRef}
          data-slot="code-editor"
          {...{ [APP_HISTORY_ATTRIBUTE]: 'app' }}
          className="absolute inset-0"
        />
        <LoadNotice load={load} />
      </div>
      <CodeFooter diagramId={props.diagramId} cursor={cursor} />
    </div>
  );
}
