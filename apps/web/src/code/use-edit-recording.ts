import { useEffect } from 'react';

import { changeLabel, diagramIdOf, toEditSelection } from './editor-binding.ts';
import { TYPING_GROUP } from '../workspace/edit-history.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { ChangeKind } from './editor-binding.ts';
import type { EditorHandle } from './use-monaco-editor.ts';
import type { WorkspaceState } from '../workspace/workspace-state.ts';
import type { editor, IDisposable, Selection } from 'monaco-editor/editor/editor.api.js';

/** A paste may land a moment after its DOM event (Monaco applies some asynchronously). */
const CLIPBOARD_WINDOW_MS: number = 1000;

const CLIPBOARD_EVENTS: readonly Exclude<ChangeKind, 'typing'>[] = ['paste', 'cut', 'drop'];

/** Remembers a paste, cut or drop until the content change it causes takes it. */
export class ChangeKindTracker {
  private kind: ChangeKind = 'typing';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly dom: HTMLElement;

  constructor(dom: HTMLElement) {
    this.dom = dom;
    for (const event of CLIPBOARD_EVENTS) {
      dom.addEventListener(event, this.onClipboard, true);
    }
  }

  /** The kind of the change happening now; typing unless a clipboard event just fired. */
  take = (): ChangeKind => {
    const taken: ChangeKind = this.kind;
    this.kind = 'typing';
    return taken;
  };

  dispose = (): void => {
    clearTimeout(this.timer);
    for (const event of CLIPBOARD_EVENTS) {
      this.dom.removeEventListener(event, this.onClipboard, true);
    }
  };

  private readonly onClipboard = (event: Event): void => {
    this.kind = CLIPBOARD_EVENTS.find((kind) => kind === event.type) ?? 'typing';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.kind = 'typing';
    }, CLIPBOARD_WINDOW_MS);
  };
}

/**
 * Records what the user changed in the editor as one history step: typing merges into a group,
 * a paste, cut or drop is its own step. A change that only mirrors the store (undo, Claude) is skipped.
 */
export function recordChange(target: editor.IStandaloneCodeEditor, kind: ChangeKind): void {
  const model: editor.ITextModel | null = target.getModel();
  const diagramId: string | null = model === null ? null : diagramIdOf(model);
  const state: WorkspaceState = useWorkspaceStore.getState();
  const stored: string | undefined = state.diagrams.find((item) => item.id === diagramId)?.code;
  const code: string | undefined = model?.getValue();
  if (diagramId === null || code === undefined || stored === undefined || stored === code) {
    return;
  }
  const selection: Selection | null = target.getSelection();
  state.applyEdit(code, {
    label: changeLabel(kind),
    source: 'code',
    group: kind === 'typing' ? TYPING_GROUP : null,
    sel: selection === null ? null : toEditSelection(selection),
    diagramId,
  });
}

function closeGroup(): void {
  useWorkspaceStore.getState().closeEditGroup();
}

/** Wires the editor's events to the history; returns the cleanup. */
function subscribe({ editor: target, monaco }: EditorHandle): () => void {
  const tracker: ChangeKindTracker = new ChangeKindTracker(target.getContainerDomNode());
  const subscriptions: IDisposable[] = [
    target.onDidChangeModelContent(() => {
      recordChange(target, tracker.take());
    }),
    target.onDidChangeCursorSelection((event) => {
      if (event.source === 'mouse' || event.reason === monaco.editor.CursorChangeReason.Explicit) {
        closeGroup();
      }
    }),
    target.onDidBlurEditorText(closeGroup),
  ];
  return (): void => {
    tracker.dispose();
    for (const subscription of subscriptions) {
      subscription.dispose();
    }
  };
}

/** Typing, paste, cut and drop go into the app's history; clicks, arrow keys and blur end a group. */
export function useEditRecording(handle: EditorHandle | null): void {
  useEffect(() => (handle === null ? undefined : subscribe(handle)), [handle]);
}
