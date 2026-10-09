import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_UI_PREFS, parseSavedUiPrefs, pickUiPrefs } from './ui-prefs.ts';
import { safeLocalStorage } from '../lib/safe-storage.ts';

import type { PanelId, UiPrefs } from './ui-prefs.ts';
import type { ModelId } from '@nautink/contracts/models';
import type { ThemePreference } from '@nautink/ui/theme';
import type { Mutate, StoreApi, UseBoundStore } from 'zustand';

/** The `localStorage` key. `index.html` reads the theme from it before the app loads. */
export const UI_STORAGE_KEY: string = 'nautink.ui';

/** Overlays are session state: they never reopen on reload. */
export interface UiOverlays {
  isPaletteOpen: boolean;
  isSettingsOpen: boolean;
  isTemplatesOpen: boolean;
  /** Bumped to ask the chat composer to take focus (⌘/). */
  composerFocusRequest: number;
}

export interface UiActions {
  togglePanel: (panel: PanelId) => void;
  setActivePanel: (panel: PanelId | null) => void;
  toggleCodeDrawer: () => void;
  setCodeDrawerOpen: (isOpen: boolean) => void;
  setThemePreference: (preference: ThemePreference) => void;
  setDefaultModel: (model: ModelId | null) => void;
  setPaletteOpen: (isOpen: boolean) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setTemplatesOpen: (isOpen: boolean) => void;
  focusComposer: () => void;
}

export type UiState = UiPrefs & UiOverlays & UiActions;

type SetUiState = StoreApi<UiState>['setState'];

const INITIAL_OVERLAYS: UiOverlays = {
  isPaletteOpen: false,
  isSettingsOpen: false,
  isTemplatesOpen: false,
  composerFocusRequest: 0,
};

type LayoutActions = Pick<
  UiActions,
  'togglePanel' | 'setActivePanel' | 'toggleCodeDrawer' | 'setCodeDrawerOpen'
>;

function layoutActions(set: SetUiState): LayoutActions {
  return {
    togglePanel: (panel: PanelId): void => {
      set((state) => ({ activePanel: state.activePanel === panel ? null : panel }));
    },
    setActivePanel: (panel: PanelId | null): void => {
      set({ activePanel: panel });
    },
    toggleCodeDrawer: (): void => {
      set((state) => ({ isCodeDrawerOpen: !state.isCodeDrawerOpen }));
    },
    setCodeDrawerOpen: (isOpen: boolean): void => {
      set({ isCodeDrawerOpen: isOpen });
    },
  };
}

function preferenceActions(
  set: SetUiState,
): Pick<UiActions, 'setThemePreference' | 'setDefaultModel'> {
  return {
    setThemePreference: (preference: ThemePreference): void => {
      set({ themePreference: preference });
    },
    setDefaultModel: (model: ModelId | null): void => {
      set({ defaultModel: model });
    },
  };
}

function overlayActions(
  set: SetUiState,
): Pick<UiActions, 'setPaletteOpen' | 'setSettingsOpen' | 'setTemplatesOpen'> {
  return {
    setPaletteOpen: (isOpen: boolean): void => {
      set({ isPaletteOpen: isOpen });
    },
    setSettingsOpen: (isOpen: boolean): void => {
      set({ isSettingsOpen: isOpen });
    },
    setTemplatesOpen: (isOpen: boolean): void => {
      set({ isTemplatesOpen: isOpen });
    },
  };
}

/** ⌘/: open the chat panel and ask its composer to take focus. */
function focusComposerAction(set: SetUiState): UiActions['focusComposer'] {
  return (): void => {
    set((state) => ({
      activePanel: 'chat',
      isPaletteOpen: false,
      composerFocusRequest: state.composerFocusRequest + 1,
    }));
  };
}

/** The shell's UI state: which panel is open, overlays, and the remembered preferences. */
export const useUiStore: UseBoundStore<Mutate<StoreApi<UiState>, [['zustand/persist', UiPrefs]]>> =
  create<UiState>()(
    persist<UiState, [], [], UiPrefs>(
      (set) => ({
        ...DEFAULT_UI_PREFS,
        ...INITIAL_OVERLAYS,
        ...layoutActions(set),
        ...preferenceActions(set),
        ...overlayActions(set),
        focusComposer: focusComposerAction(set),
      }),
      {
        name: UI_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => safeLocalStorage),
        partialize: pickUiPrefs,
        merge: (saved, current) => ({ ...current, ...parseSavedUiPrefs(saved) }),
      },
    ),
  );

/** Back to the defaults with every overlay closed. For tests and "reset layout". */
export function resetUiState(): void {
  useUiStore.setState({ ...DEFAULT_UI_PREFS, ...INITIAL_OVERLAYS });
}
