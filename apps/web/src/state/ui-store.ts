import { isModelOfAgent } from '@nautink/contracts/chat';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_UI_PREFS, parseSavedUiPrefs, pickUiPrefs } from './ui-prefs.ts';
import { safeLocalStorage } from '../lib/safe-storage.ts';

import type { PanelId, UiPrefs } from './ui-prefs.ts';
import type { AgentId } from '@nautink/contracts/agents';
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
  setLibraryOpen: (isOpen: boolean) => void;
  setThemePreference: (preference: ThemePreference) => void;
  /** Picks the agent; a different agent starts on its own default model. */
  setAgent: (agent: AgentId) => void;
  /** Throws when `model` is not one of the current agent's. */
  setDefaultModel: (model: string | null) => void;
  setReviewChanges: (isOn: boolean) => void;
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
  'togglePanel' | 'setActivePanel' | 'toggleCodeDrawer' | 'setCodeDrawerOpen' | 'setLibraryOpen'
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
    setLibraryOpen: (isOpen: boolean): void => {
      set({ isLibraryOpen: isOpen });
    },
  };
}

function preferenceActions(
  set: SetUiState,
): Pick<UiActions, 'setThemePreference' | 'setDefaultModel' | 'setReviewChanges'> {
  return {
    setThemePreference: (preference: ThemePreference): void => {
      set({ themePreference: preference });
    },
    setDefaultModel: (model: string | null): void => {
      set((state) => {
        if (!isModelOfAgent(model, state.agent)) {
          throw new Error(`Model "${String(model)}" is not a ${state.agent} model.`);
        }
        return { defaultModel: model };
      });
    },
    setReviewChanges: (isOn: boolean): void => {
      set({ shouldReviewChanges: isOn });
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

function setAgentAction(set: SetUiState): UiActions['setAgent'] {
  return (agent: AgentId): void => {
    set((state) => (state.agent === agent ? {} : { agent, defaultModel: null }));
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
        setAgent: setAgentAction(set),
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
