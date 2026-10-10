import { MODEL_IDS } from '@nautink/contracts/models';
import { THEME_PREFERENCES } from '@nautink/ui/theme';
import { z } from 'zod';

import type { ModelId } from '@nautink/contracts/models';
import type { ThemePreference } from '@nautink/ui/theme';

/** The side panels the rail opens, one at a time (PRD §5). */
export type PanelId = 'chat' | 'diagrams' | 'history';

export const PANEL_IDS: readonly PanelId[] = ['chat', 'diagrams', 'history'];

/**
 * The UI choices remembered across reloads. Nothing about diagrams is stored here: Preview / Edit /
 * Split is the diagram's own `view`.
 */
export interface UiPrefs {
  activePanel: PanelId | null;
  isCodeDrawerOpen: boolean;
  /** The visual editor's library panel (v1's `mc.library`), for every diagram. */
  isLibraryOpen: boolean;
  themePreference: ThemePreference;
  /** `null` means Claude Code's own default model. */
  defaultModel: ModelId | null;
}

export const DEFAULT_UI_PREFS: UiPrefs = {
  activePanel: 'chat',
  isCodeDrawerOpen: false,
  isLibraryOpen: false,
  themePreference: 'system',
  defaultModel: null,
};

export const uiPrefsSchema: z.ZodType<UiPrefs> = z.object({
  activePanel: z.enum(PANEL_IDS).nullable(),
  isCodeDrawerOpen: z.boolean(),
  // Saves from before this field existed keep the rest of their preferences.
  isLibraryOpen: z.boolean().default(false),
  themePreference: z.enum(THEME_PREFERENCES),
  defaultModel: z.enum(MODEL_IDS).nullable(),
});

/** Picks the preference fields out of a larger state object. */
export function pickUiPrefs(state: UiPrefs): UiPrefs {
  return {
    activePanel: state.activePanel,
    isCodeDrawerOpen: state.isCodeDrawerOpen,
    isLibraryOpen: state.isLibraryOpen,
    themePreference: state.themePreference,
    defaultModel: state.defaultModel,
  };
}

/**
 * The saved preferences, or the defaults when what was saved does not parse (an older shape, or
 * hand-edited storage). A bad preference must not keep the app from starting.
 */
export function parseSavedUiPrefs(saved: unknown): UiPrefs {
  const result: z.ZodSafeParseResult<UiPrefs> = uiPrefsSchema.safeParse(saved);
  return result.success ? result.data : DEFAULT_UI_PREFS;
}
