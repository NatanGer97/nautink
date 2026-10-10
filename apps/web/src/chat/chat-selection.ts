// The selection a chat message carries (PRD §4.1): the canvas selection of the open diagram, until
// the user removes the composer chip. A removed chip stays removed until the selection changes.
import { create } from 'zustand';

import { useCanvasSelectionStore } from '../edit/selection/canvas-selection.ts';

import type { CanvasSelection, SelectedItem } from '../edit/selection/canvas-selection.ts';
import type { ChatSelection } from '@nautink/contracts/chat';
import type { StoreApi, UseBoundStore } from 'zustand';

interface ChipState {
  /**
   * The selection the chip was removed for. The canvas store makes a new list on every change, so
   * comparing by reference is "has the selection changed since".
   */
  dismissedFor: readonly SelectedItem[] | null;
}

const useChipStore: UseBoundStore<StoreApi<ChipState>> = create<ChipState>()(() => ({
  dismissedFor: null,
}));

const NONE: readonly SelectedItem[] = [];

function chipItems(
  selection: CanvasSelection,
  dismissedFor: readonly SelectedItem[] | null,
  diagramId: string | undefined,
): readonly SelectedItem[] {
  const isShown: boolean =
    diagramId !== undefined &&
    selection.diagramId === diagramId &&
    selection.items !== dismissedFor;
  return isShown ? selection.items : NONE;
}

/** The selection as `POST /api/chat` carries it, or null for none. */
export function toChatSelection(items: readonly SelectedItem[]): ChatSelection | null {
  if (items.length === 0) {
    return null;
  }
  return {
    ids: items.map((item) => item.id),
    labels: items.map((item) => item.label),
    kinds: items.map((item) => item.kind),
  };
}

/** The items the chip shows for `diagramId`: empty when nothing is selected or the chip was removed. */
export function useSelectionChip(diagramId: string | undefined): readonly SelectedItem[] {
  const selectedIn: string | null = useCanvasSelectionStore((state) => state.diagramId);
  const items: readonly SelectedItem[] = useCanvasSelectionStore((state) => state.items);
  const dismissedFor: readonly SelectedItem[] | null = useChipStore((state) => state.dismissedFor);
  return chipItems({ diagramId: selectedIn, items }, dismissedFor, diagramId);
}

/** What a message sent now about `diagramId` carries: the chip's selection, or null. */
export function chatSelectionFor(diagramId: string): ChatSelection | null {
  const selection: CanvasSelection = useCanvasSelectionStore.getState();
  return toChatSelection(chipItems(selection, useChipStore.getState().dismissedFor, diagramId));
}

/** Removes the chip: messages apply to the whole diagram until the selection changes. */
export function removeSelectionChip(): void {
  useChipStore.setState({ dismissedFor: useCanvasSelectionStore.getState().items });
}

/** Shows the chip again. For tests. */
export function resetSelectionChip(): void {
  useChipStore.setState({ dismissedFor: null });
}
