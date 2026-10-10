// Loaded on demand (`code-review.tsx`): Monaco's diff editor for a proposal (PRD §4.2).
import { useEffect, useRef, useState } from 'react';

import { loadMonaco } from '../code/load-monaco.ts';
import { MERMAID_LANGUAGE_ID } from '../code/mermaid-language.ts';
import { monacoThemeName } from '../code/monaco-themes.ts';
import { useIsDarkTheme } from '../lib/use-is-dark-theme.ts';

import type { MonacoApi } from '../code/monaco-setup.ts';
import type { editor } from 'monaco-editor/editor/editor.api.js';
import type { ReactElement, RefObject } from 'react';

/** PRD §6.2 code type; inline, because the drawer is too narrow for two columns. */
const DIFF_OPTIONS: editor.IStandaloneDiffEditorConstructionOptions = {
  readOnly: true,
  originalEditable: false,
  renderSideBySide: false,
  automaticLayout: true,
  minimap: { enabled: false },
  fontFamily: "'Geist Mono', ui-monospace, Menlo, monospace",
  fontSize: 12.5,
  lineHeight: 20,
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  renderOverviewRuler: false,
  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
};

type DiffLoad = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export interface ProposalDiffProps {
  before: string;
  after: string;
  /** Names the diff region for screen readers. */
  label?: string;
}

interface DiffMount {
  container: HTMLElement;
  code: ProposalDiffProps;
  isDark: boolean;
}

/** Creates the diff editor with its two models; the result disposes all three. */
function createDiff(monaco: MonacoApi, { container, code, isDark }: DiffMount): () => void {
  const original: editor.ITextModel = monaco.editor.createModel(code.before, MERMAID_LANGUAGE_ID);
  const modified: editor.ITextModel = monaco.editor.createModel(code.after, MERMAID_LANGUAGE_ID);
  const diff: editor.IStandaloneDiffEditor = monaco.editor.createDiffEditor(
    container,
    DIFF_OPTIONS,
  );
  diff.setModel({ original, modified });
  monaco.editor.setTheme(monacoThemeName(isDark));
  return (): void => {
    diff.dispose();
    original.dispose();
    modified.dispose();
  };
}

/** Loads Monaco and mounts the diff; the returned cleanup also covers a load still running. */
function mountDiff(mount: DiffMount, onLoad: (load: DiffLoad) => void): () => void {
  let dispose: (() => void) | null = null;
  let isMounted: boolean = true;
  const run = async (): Promise<void> => {
    try {
      const monaco: MonacoApi = await loadMonaco();
      if (isMounted) {
        dispose = createDiff(monaco, mount);
        onLoad({ status: 'ready' });
      }
    } catch (err) {
      const reason: string = err instanceof Error ? err.message : String(err);
      onLoad({ status: 'error', message: `Could not load the diff: ${reason}` });
    }
  };
  void run();
  return (): void => {
    isMounted = false;
    dispose?.();
  };
}

function useDiffEditor(ref: RefObject<HTMLDivElement | null>, code: ProposalDiffProps): DiffLoad {
  const [load, setLoad] = useState<DiffLoad>({ status: 'loading' });
  const isDark: boolean = useIsDarkTheme();
  const { before, after } = code;
  useEffect(() => {
    const container: HTMLDivElement | null = ref.current;
    return container === null
      ? undefined
      : mountDiff({ container, code: { before, after }, isDark }, setLoad);
  }, [ref, before, after, isDark]);
  return load;
}

/** "Loading the diff…", or why it failed; nothing once the diff is up. */
function DiffNotice({ load }: { load: DiffLoad }): ReactElement | null {
  if (load.status === 'ready') {
    return null;
  }
  const isError: boolean = load.status === 'error';
  return (
    <p
      role={isError ? 'alert' : 'status'}
      className="absolute inset-x-0 top-0 px-3.5 py-2.5 text-muted-foreground"
    >
      {load.status === 'error' ? load.message : 'Loading the diff…'}
    </p>
  );
}

/** The proposal as a read-only code diff: removed lines red, added lines green (Monaco). */
export function ProposalDiff({
  label = 'Proposed code changes',
  ...code
}: ProposalDiffProps): ReactElement {
  const containerRef: RefObject<HTMLDivElement | null> = useRef<HTMLDivElement | null>(null);
  const load: DiffLoad = useDiffEditor(containerRef, code);
  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        role="region"
        aria-label={label}
        data-slot="proposal-diff"
        className="absolute inset-0"
      />
      <DiffNotice load={load} />
    </div>
  );
}
