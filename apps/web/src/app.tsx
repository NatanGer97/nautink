import { Toaster } from '@nautink/ui/components/sonner';
import { TooltipProvider } from '@nautink/ui/components/tooltip';

import { CommandPalette } from './commands/command-palette.tsx';
import { buildShellCommands } from './commands/shell-commands.ts';
import { useRegisterCommands } from './commands/use-commands.ts';
import { AppShell } from './shell/app-shell.tsx';
import { TemplatesDialog } from './shell/templates-dialog.tsx';
import { useAppliedTheme } from './shell/use-applied-theme.ts';
import { useGlobalShortcuts } from './shell/use-global-shortcuts.ts';
import { useUiStore } from './state/ui-store.ts';
import { useWorkspaceLifecycle } from './workspace/use-workspace-lifecycle.ts';

import type { AppCommand } from './commands/command-registry.ts';
import type { ResolvedTheme, ThemePreference } from '@nautink/ui/theme';
import type { ReactElement } from 'react';

/** Built once: each command reads the store when it runs, so it never goes stale. */
const SHELL_COMMANDS: readonly AppCommand[] = buildShellCommands(useUiStore.getState);

/** Tooltips wait a beat so moving across the rail does not flash every label. */
const TOOLTIP_DELAY_MS: number = 300;

/** The whole app: the shell, its overlays, and the app-wide theme and shortcuts. */
export function App(): ReactElement {
  const preference: ThemePreference = useUiStore((state) => state.themePreference);
  const theme: ResolvedTheme = useAppliedTheme(preference);
  useGlobalShortcuts();
  useWorkspaceLifecycle();
  useRegisterCommands(SHELL_COMMANDS);
  return (
    <TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>
      <AppShell />
      <CommandPalette />
      <TemplatesDialog />
      <Toaster theme={theme} />
    </TooltipProvider>
  );
}
