import { pressSaveVersion } from './save-version-dialog-store.ts';
import { SHORTCUTS, shortcutLabel } from '../lib/shortcuts.ts';

import type { AppCommand } from '../commands/command-registry.ts';

/** "Save version" in the ⌘K palette. */
export const HISTORY_COMMANDS: readonly AppCommand[] = [
  {
    id: 'version.save',
    group: 'Diagram',
    title: 'Save version',
    shortcut: shortcutLabel(SHORTCUTS.saveVersion),
    keywords: ['snapshot', 'history'],
    isDeferred: true,
    run: pressSaveVersion,
  },
];
