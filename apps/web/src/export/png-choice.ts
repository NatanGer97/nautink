import { create } from 'zustand';

import type { PngChoice } from './export-actions.ts';
import type { StoreApi, UseBoundStore } from 'zustand';

interface PngChoiceState extends PngChoice {
  setScale: (scale: number) => void;
  setTransparent: (isTransparent: boolean) => void;
}

/** The PNG scale and background picked in the export menu; ⇧⌘C copies with the same choice. */
export const usePngChoiceStore: UseBoundStore<StoreApi<PngChoiceState>> = create<PngChoiceState>()(
  (set) => ({
    scale: 2,
    isTransparent: false,
    setScale: (scale: number): void => {
      set({ scale });
    },
    setTransparent: (isTransparent: boolean): void => {
      set({ isTransparent });
    },
  }),
);

/** The current choice, outside React. */
export function currentPngChoice(): PngChoice {
  const { scale, isTransparent } = usePngChoiceStore.getState();
  return { scale, isTransparent };
}
