import { useEffect } from 'react';
import { create } from 'zustand';

import type { StoreApi, UseBoundStore } from 'zustand';

/**
 * One selected canvas item. `id` is the Mermaid id (node id, class name, entity, state), so the
 * preview half of Split can find the same shape; `kind` is a noun such as `node`, `link` or `group`.
 */
export interface SelectedItem {
  id: string;
  label: string;
  kind: string;
}

/** What is selected in the visual editor, and in which diagram. */
export interface CanvasSelection {
  diagramId: string | null;
  items: readonly SelectedItem[];
}

/** A request to select items, from outside the editor (a click in Split's preview half). */
export interface SelectionRequest {
  diagramId: string;
  ids: readonly string[];
  /** Bumped per request, so asking for the same ids twice still selects them again. */
  serial: number;
}

interface SelectionState extends CanvasSelection {
  request: SelectionRequest | null;
}

const NOTHING: SelectionState = { diagramId: null, items: [], request: null };

/** Session state: the editor writes it, other features (Split, the selection-aware prompt) read it. */
export const useCanvasSelectionStore: UseBoundStore<StoreApi<SelectionState>> =
  create<SelectionState>()(() => NOTHING);

function sameItems(a: readonly SelectedItem[], b: readonly SelectedItem[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The editor reports its selection here whenever it changes. */
export function publishSelection(diagramId: string, items: readonly SelectedItem[]): void {
  const state: SelectionState = useCanvasSelectionStore.getState();
  if (state.diagramId !== diagramId || !sameItems(state.items, items)) {
    useCanvasSelectionStore.setState({ diagramId, items: [...items] });
  }
}

/** Nothing selected (the editor unmounted, or another diagram opened). */
export function clearSelection(): void {
  useCanvasSelectionStore.setState({ diagramId: null, items: [] });
}

/** Asks the editor of `diagramId` to select `ids` (Split mirrors a preview click this way). */
export function requestSelection(diagramId: string, ids: readonly string[]): void {
  const serial: number = (useCanvasSelectionStore.getState().request?.serial ?? 0) + 1;
  useCanvasSelectionStore.setState({ request: { diagramId, ids: [...ids], serial } });
}

/** The current selection. For the selection-aware prompt (PRD §4.1) and Split. */
export function useCanvasSelection(): CanvasSelection {
  const diagramId: string | null = useCanvasSelectionStore((state) => state.diagramId);
  const items: readonly SelectedItem[] = useCanvasSelectionStore((state) => state.items);
  return { diagramId, items };
}

/** The selected ids of one diagram (empty for any other). */
export function selectedIdsOf(selection: CanvasSelection, diagramId: string): string[] {
  return selection.diagramId === diagramId ? selection.items.map((item) => item.id) : [];
}

const PLURALS: Readonly<Record<string, string>> = { class: 'classes', entity: 'entities' };

function plural(kind: string, count: number): string {
  if (count === 1) {
    return kind;
  }
  return PLURALS[kind] ?? `${kind}s`;
}

/** "2 nodes selected", "1 link selected", "3 items selected" (mixed kinds), or '' for none. */
export function selectionSummary(items: readonly SelectedItem[]): string {
  const kinds: Set<string> = new Set<string>(items.map((item) => item.kind));
  const only: string | undefined = [...kinds][0];
  if (items.length === 0) {
    return '';
  }
  const noun: string = kinds.size === 1 && only !== undefined ? only : 'item';
  return `${String(items.length)} ${plural(noun, items.length)} selected`;
}

/** Runs `select` with each new request for `diagramId`, once per request. */
export function useSelectionRequests(
  diagramId: string,
  select: (ids: readonly string[]) => void,
): void {
  useEffect(
    () =>
      useCanvasSelectionStore.subscribe((state, previous) => {
        const request: SelectionRequest | null = state.request;
        if (request !== null && request !== previous.request && request.diagramId === diagramId) {
          select(request.ids);
        }
      }),
    [diagramId, select],
  );
}

/** Back to nothing selected. For tests. */
export function resetCanvasSelection(): void {
  useCanvasSelectionStore.setState(NOTHING);
}
