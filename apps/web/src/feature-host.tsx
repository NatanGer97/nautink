import { useRegisterCommands } from './commands/use-commands.ts';
import { CompareDrawer } from './history/compare-drawer.tsx';
import { HISTORY_COMMANDS } from './history/history-commands.ts';
import { SaveVersionDialog } from './history/save-version-dialog.tsx';
import { useSaveVersionShortcut } from './history/use-save-version-shortcut.ts';
import { useVersionSync } from './history/use-version-sync.ts';
import { DropOverlay } from './import/drop-overlay.tsx';
import { IMPORT_COMMANDS } from './import/import-commands.ts';
import { TEMPLATE_COMMANDS } from './templates/template-commands.ts';

import type { ReactElement } from 'react';

/** Version history, import and templates: overlays, shortcuts, ⌘K commands and store sync, mounted by `App`. */
export function FeatureHost(): ReactElement {
  useVersionSync();
  useSaveVersionShortcut();
  useRegisterCommands(HISTORY_COMMANDS);
  useRegisterCommands(IMPORT_COMMANDS);
  useRegisterCommands(TEMPLATE_COMMANDS);
  return (
    <>
      <SaveVersionDialog />
      <CompareDrawer />
      <DropOverlay />
    </>
  );
}
