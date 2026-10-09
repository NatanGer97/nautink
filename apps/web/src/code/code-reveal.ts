import { useEffect } from 'react';
import { create } from 'zustand';

import { useFocusModeStore } from '../preview/focus-mode.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { EditorHandle } from './use-monaco-editor.ts';
import type { editor } from 'monaco-editor/editor/editor.api.js';
import type { StoreApi, UseBoundStore } from 'zustand';

/** A line the code editor should select and scroll to, in one diagram. */
export interface RevealRequest {
  diagramId: string;
  line: number;
}

interface CodeRevealState {
  request: RevealRequest | null;
}

/** The pending request; it waits here while Monaco loads after the drawer opens. */
export const useCodeRevealStore: UseBoundStore<StoreApi<CodeRevealState>> =
  create<CodeRevealState>()(() => ({ request: null }));

/** Opens the code drawer (leaving focus mode) and selects `line` of the diagram's code. */
export function revealLineInCode(request: RevealRequest): void {
  useFocusModeStore.getState().setFocusMode(false);
  useUiStore.getState().setCodeDrawerOpen(true);
  useCodeRevealStore.setState({ request: { ...request } });
}

function selectLine(
  target: editor.IStandaloneCodeEditor,
  model: editor.ITextModel,
  line: number,
): void {
  const clamped: number = Math.min(Math.max(line, 1), model.getLineCount());
  target.setSelection({
    selectionStartLineNumber: clamped,
    selectionStartColumn: 1,
    positionLineNumber: clamped,
    positionColumn: model.getLineMaxColumn(clamped),
  });
  target.revealLineInCenter(clamped);
  target.focus();
}

/** Carries out a reveal request once the editor shows that diagram's model. */
export function useRevealRequests(handle: EditorHandle | null, diagramId: string): void {
  const request: RevealRequest | null = useCodeRevealStore((state) => state.request);
  useEffect(() => {
    const model: editor.ITextModel | null = handle?.editor.getModel() ?? null;
    if (handle === null || model === null || request?.diagramId !== diagramId) {
      return;
    }
    selectLine(handle.editor, model, request.line);
    useCodeRevealStore.setState({ request: null });
  }, [handle, diagramId, request]);
}
