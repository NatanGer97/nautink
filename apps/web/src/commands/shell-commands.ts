import { THEME_LABELS, THEME_PREFERENCES } from '@nautink/ui/theme';

import { SHORTCUTS, shortcutLabel } from '../lib/shortcuts.ts';
import { PANEL_IDS } from '../state/ui-prefs.ts';

import type { AppCommand } from './command-registry.ts';
import type { PanelId } from '../state/ui-prefs.ts';
import type { UiState } from '../state/ui-store.ts';

type GetUiState = () => UiState;

export const PANEL_LABELS: Readonly<Record<PanelId, string>> = {
  chat: 'Chat',
  diagrams: 'Diagrams',
  history: 'History',
};

function panelCommands(getState: GetUiState): AppCommand[] {
  return PANEL_IDS.map((panel) => ({
    id: `panel.${panel}`,
    group: 'Panels',
    title: `Show ${PANEL_LABELS[panel].toLowerCase()}`,
    run: (): void => {
      getState().setActivePanel(panel);
    },
  }));
}

function closePanelCommand(getState: GetUiState): AppCommand {
  return {
    id: 'panel.close',
    group: 'Panels',
    title: 'Close the side panel',
    run: (): void => {
      getState().setActivePanel(null);
    },
  };
}

function toggleCodeCommand(getState: GetUiState): AppCommand {
  return {
    id: 'code.toggle',
    group: 'Panels',
    title: 'Toggle code',
    keywords: ['drawer', 'editor'],
    run: (): void => {
      getState().toggleCodeDrawer();
    },
  };
}

function themeCommands(getState: GetUiState): AppCommand[] {
  return THEME_PREFERENCES.map((preference) => ({
    id: `theme.${preference}`,
    group: 'Appearance',
    title: `Use ${THEME_LABELS[preference].toLowerCase()} theme`,
    keywords: ['theme', 'appearance'],
    run: (): void => {
      getState().setThemePreference(preference);
    },
  }));
}

function focusComposerCommand(getState: GetUiState): AppCommand {
  return {
    id: 'chat.focus',
    group: 'Chat',
    title: 'Focus the chat composer',
    shortcut: shortcutLabel(SHORTCUTS.focusComposer),
    run: (): void => {
      getState().focusComposer();
    },
  };
}

function settingsCommand(getState: GetUiState): AppCommand {
  return {
    id: 'app.settings',
    group: 'App',
    title: 'Open settings',
    keywords: ['preferences', 'model'],
    run: (): void => {
      getState().setSettingsOpen(true);
    },
  };
}

/** The shell's own palette commands: panels, the code drawer, theme, settings. */
export function buildShellCommands(getState: GetUiState): AppCommand[] {
  return [
    ...panelCommands(getState),
    closePanelCommand(getState),
    toggleCodeCommand(getState),
    ...themeCommands(getState),
    focusComposerCommand(getState),
    settingsCommand(getState),
  ];
}
