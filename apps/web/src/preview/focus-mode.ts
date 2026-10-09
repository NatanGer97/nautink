import { useEffect } from 'react';
import { create } from 'zustand';

import type { StoreApi, UseBoundStore } from 'zustand';

/** Focus mode hides the rail, the side panel and the code drawer (v1's fullscreen preview). */
export interface FocusModeState {
  isFocusMode: boolean;
  setFocusMode: (isOn: boolean) => void;
  toggleFocusMode: () => void;
}

/** Session state only: focus mode never comes back by itself after a reload. */
export const useFocusModeStore: UseBoundStore<StoreApi<FocusModeState>> = create<FocusModeState>()(
  (set) => ({
    isFocusMode: false,
    setFocusMode: (isOn: boolean): void => {
      set({ isFocusMode: isOn });
    },
    toggleFocusMode: (): void => {
      set((state) => ({ isFocusMode: !state.isFocusMode }));
    },
  }),
);

/** True while focus mode hides the rail and the panels. */
export function useIsFocusMode(): boolean {
  return useFocusModeStore((state) => state.isFocusMode);
}

/** Esc leaves focus mode, unless something else (a menu, a dialog) already handled it. */
export function useFocusModeEscape(): void {
  const isFocusMode: boolean = useIsFocusMode();
  useEffect(() => {
    if (!isFocusMode) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        useFocusModeStore.getState().setFocusMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFocusMode]);
}
