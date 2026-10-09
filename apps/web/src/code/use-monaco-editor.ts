import { useEffect, useState } from 'react';

import { loadMonaco } from './load-monaco.ts';
import { MERMAID_LANGUAGE_ID } from './mermaid-language.ts';
import { monacoThemeName } from './monaco-themes.ts';

import type { MonacoApi } from './monaco-setup.ts';
import type { editor } from 'monaco-editor/editor/editor.api.js';
import type { RefObject } from 'react';

/** Monaco and the one editor the code drawer shows. */
export interface EditorHandle {
  monaco: MonacoApi;
  editor: editor.IStandaloneCodeEditor;
}

export type EditorLoad =
  | { status: 'loading' }
  | { status: 'ready'; handle: EditorHandle }
  | { status: 'error'; message: string };

/** PRD §6.2: Geist Mono 12.5 / 20. */
const EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  model: null,
  language: MERMAID_LANGUAGE_ID,
  minimap: { enabled: false },
  fontFamily: "'Geist Mono', ui-monospace, Menlo, monospace",
  fontSize: 12.5,
  lineHeight: 20,
  lineNumbersMinChars: 3,
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  tabSize: 4,
  automaticLayout: true,
  padding: { top: 10, bottom: 10 },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  renderLineHighlight: 'line',
  fixedOverflowWidgets: true,
  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
};

/** Loads Monaco, then creates the editor unless the drawer closed in the meantime. */
async function createEditor(container: HTMLElement, isWanted: () => boolean): Promise<EditorLoad> {
  try {
    const monaco: MonacoApi = await loadMonaco();
    if (!isWanted()) {
      return { status: 'loading' };
    }
    return {
      status: 'ready',
      handle: { monaco, editor: monaco.editor.create(container, EDITOR_OPTIONS) },
    };
  } catch (err) {
    const reason: string = err instanceof Error ? err.message : String(err);
    return { status: 'error', message: `Could not load the code editor: ${reason}` };
  }
}

/** Creates the editor in `container`; the returned cleanup disposes it, even mid-load. */
function mountEditor(container: HTMLElement, onLoad: (load: EditorLoad) => void): () => void {
  let created: EditorHandle | null = null;
  let isMounted: boolean = true;
  const run = async (): Promise<void> => {
    const load: EditorLoad = await createEditor(container, () => isMounted);
    created = load.status === 'ready' ? load.handle : null;
    if (isMounted) {
      onLoad(load);
    }
  };
  void run();
  return (): void => {
    isMounted = false;
    created?.editor.dispose();
  };
}

/** Loads Monaco (lazily, on first use) and creates the editor inside `containerRef`. */
export function useMonacoEditor(containerRef: RefObject<HTMLDivElement | null>): EditorLoad {
  const [load, setLoad] = useState<EditorLoad>({ status: 'loading' });
  useEffect(() => {
    const container: HTMLDivElement | null = containerRef.current;
    return container === null ? undefined : mountEditor(container, setLoad);
  }, [containerRef]);
  return load;
}

/** Keeps the editor's theme in step with the app's. */
export function useEditorTheme(handle: EditorHandle | null, isDark: boolean): void {
  useEffect(() => {
    handle?.monaco.editor.setTheme(monacoThemeName(isDark));
  }, [handle, isDark]);
}
