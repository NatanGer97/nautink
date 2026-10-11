import type { MonacoApi } from './monaco-setup.ts';
import type { MermaidError } from '../mermaid/validate.ts';
import type { EditSelection } from '../workspace/undo/edit-history.ts';
import type { editor, IRange, Uri } from 'monaco-editor/editor/editor.api.js';

/** The smallest single edit that turns `before` into `after`: [start, end in before, end in after]. */
export function diffSpan(before: string, after: string): [number, number, number] {
  const max: number = Math.min(before.length, after.length);
  let start: number = 0;
  while (start < max && before[start] === after[start]) {
    start += 1;
  }
  let tail: number = 0;
  while (
    tail < max - start &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail += 1;
  }
  return [start, before.length - tail, after.length - tail];
}

const MODEL_PATH: RegExp = /^\/(.+)\.mmd$/;

/** Each diagram has its own model, so Monaco never mixes two diagrams' text. */
export function modelUri(monaco: MonacoApi, diagramId: string): Uri {
  return monaco.Uri.from({ scheme: 'inmemory', authority: 'diagram', path: `/${diagramId}.mmd` });
}

/** The diagram a model belongs to, or null for a model this app did not create. */
export function diagramIdOf(model: editor.ITextModel): string | null {
  if (model.uri.authority !== 'diagram') {
    return null;
  }
  return MODEL_PATH.exec(model.uri.path)?.[1] ?? null;
}

/** A saved version's own model: read-only, never synced into the diagram or its history. */
export function ensureVersionModel(
  monaco: MonacoApi,
  version: { id: string; code: string },
): editor.ITextModel {
  const uri: Uri = monaco.Uri.from({
    scheme: 'inmemory',
    authority: 'version',
    path: `/${version.id}.mmd`,
  });
  return monaco.editor.getModel(uri) ?? monaco.editor.createModel(version.code, 'mermaid', uri);
}

/** Disposes the version models the editor no longer shows (a version's model is made per view). */
export function disposeVersionModels(monaco: MonacoApi, keep: editor.ITextModel | null): void {
  for (const model of monaco.editor.getModels()) {
    if (model.uri.authority === 'version' && model !== keep) {
      model.dispose();
    }
  }
}

/** The diagram's model, created on first use. */
export function ensureModel(monaco: MonacoApi, diagramId: string, code: string): editor.ITextModel {
  const uri: Uri = modelUri(monaco, diagramId);
  return monaco.editor.getModel(uri) ?? monaco.editor.createModel(code, 'mermaid', uri);
}

/**
 * Writes `code` into the model as one minimal edit, so the cursor and the scroll position outside
 * the change stay put (v1's `applyCode`). Returns the offset where the change ends, or -1 when the
 * model already had `code`.
 */
export function syncModel(model: editor.ITextModel, code: string): number {
  const current: string = model.getValue();
  if (current === code) {
    return -1;
  }
  const [start, endBefore, endAfter] = diffSpan(current, code);
  const from: { lineNumber: number; column: number } = model.getPositionAt(start);
  const to: { lineNumber: number; column: number } = model.getPositionAt(endBefore);
  const range: IRange = {
    startLineNumber: from.lineNumber,
    startColumn: from.column,
    endLineNumber: to.lineNumber,
    endColumn: to.column,
  };
  model.applyEdits([{ range, text: code.slice(start, endAfter) }]);
  return endAfter;
}

/** Where the cursor was, for the step's `sel` (redo puts it back). */
export function toEditSelection(selection: {
  selectionStartLineNumber: number;
  selectionStartColumn: number;
  positionLineNumber: number;
  positionColumn: number;
}): EditSelection {
  return {
    anchorLine: selection.selectionStartLineNumber,
    anchorCol: selection.selectionStartColumn,
    line: selection.positionLineNumber,
    col: selection.positionColumn,
  };
}

/** The error marker on the failing line (line 1 when Mermaid names none). */
export function errorMarkers(
  monaco: MonacoApi,
  model: editor.ITextModel,
  error: MermaidError | null,
): editor.IMarkerData[] {
  if (error === null) {
    return [];
  }
  const line: number = Math.min(Math.max(error.line ?? 1, 1), model.getLineCount());
  return [
    {
      severity: monaco.MarkerSeverity.Error,
      message: error.message,
      startLineNumber: line,
      endLineNumber: line,
      startColumn: 1,
      endColumn: model.getLineMaxColumn(line),
    },
  ];
}

/** How a content change got into the editor. */
export type ChangeKind = 'typing' | 'paste' | 'cut' | 'drop';

const CHANGE_LABELS: Readonly<Record<ChangeKind, string>> = {
  typing: 'Typed in code',
  paste: 'Pasted code',
  cut: 'Cut code',
  drop: 'Moved code',
};

/** The step label for a change (sentence case, past tense, as the history wants). */
export function changeLabel(kind: ChangeKind): string {
  return CHANGE_LABELS[kind];
}
