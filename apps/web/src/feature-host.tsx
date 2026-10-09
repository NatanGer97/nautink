import { useRegisterCommands } from './commands/use-commands.ts';
import { CompareDrawer } from './history/compare-drawer.tsx';
import { HISTORY_COMMANDS } from './history/history-commands.ts';
import { SaveVersionDialog } from './history/save-version-dialog.tsx';
import { useSaveVersionShortcut } from './history/use-save-version-shortcut.ts';
import { useVersionSync } from './history/use-version-sync.ts';

import type { ReactElement } from 'react';

/** Version history's overlays, shortcut, ⌘K commands and store sync, mounted once by `App`. */
export function FeatureHost(): ReactElement {
  useVersionSync();
  useSaveVersionShortcut();
  useRegisterCommands(HISTORY_COMMANDS);
  return (
    <>
      <SaveVersionDialog />
      <CompareDrawer />
    </>
  );
}
