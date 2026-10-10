import { AGENT_IDS } from '@nautink/contracts/agents';
import { isModelOfAgent } from '@nautink/contracts/chat';
import { THEME_PREFERENCES } from '@nautink/ui/theme';
import { z } from 'zod';

import type { AgentId } from '@nautink/contracts/agents';
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
  /** The coding agent the chat runs (ADR-002). */
  agent: AgentId;
  /** One of the agent's models; `null` means the agent CLI's own default model. */
  defaultModel: string | null;
  /** Claude's changes wait on the canvas for Accept or Reject (PRD §4.2). On by default. */
  shouldReviewChanges: boolean;
}

export const DEFAULT_UI_PREFS: UiPrefs = {
  activePanel: 'chat',
  isCodeDrawerOpen: false,
  isLibraryOpen: false,
  themePreference: 'system',
  agent: 'claude',
  defaultModel: null,
  shouldReviewChanges: true,
};

export const uiPrefsSchema: z.ZodType<UiPrefs> = z
  .object({
    activePanel: z.enum(PANEL_IDS).nullable(),
    isCodeDrawerOpen: z.boolean(),
    // Saves from before this field existed keep the rest of their preferences.
    isLibraryOpen: z.boolean().default(false),
    themePreference: z.enum(THEME_PREFERENCES),
    agent: z.enum(AGENT_IDS).default('claude'),
    defaultModel: z.string().min(1).nullable(),
    shouldReviewChanges: z.boolean().default(true),
  })
  // A model that is not the agent's (hand-edited storage) falls back to the agent's default.
  .transform((prefs) =>
    isModelOfAgent(prefs.defaultModel, prefs.agent) ? prefs : { ...prefs, defaultModel: null },
  );

/** Picks the preference fields out of a larger state object. */
export function pickUiPrefs(state: UiPrefs): UiPrefs {
  return {
    activePanel: state.activePanel,
    isCodeDrawerOpen: state.isCodeDrawerOpen,
    isLibraryOpen: state.isLibraryOpen,
    themePreference: state.themePreference,
    agent: state.agent,
    defaultModel: state.defaultModel,
    shouldReviewChanges: state.shouldReviewChanges,
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
