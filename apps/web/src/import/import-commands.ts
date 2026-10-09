import { backUpAll, openFiles, pickAndRestoreBackup } from './import-files.ts';

import type { AppCommand } from '../commands/command-registry.ts';

/** Open file…, Back up all diagrams and Restore backup… in the ⌘K palette. */
export const IMPORT_COMMANDS: readonly AppCommand[] = [
  {
    id: 'workspace.open-file',
    group: 'Workspace',
    title: 'Open file…',
    keywords: ['import', 'mmd', 'markdown', 'upload'],
    run: () => void openFiles(),
  },
  {
    id: 'workspace.back-up',
    group: 'Workspace',
    title: 'Back up all diagrams',
    keywords: ['export', 'json', 'backup'],
    run: () => void backUpAll(),
  },
  {
    id: 'workspace.restore-backup',
    group: 'Workspace',
    title: 'Restore backup…',
    keywords: ['import', 'json', 'backup', 'v1'],
    run: () => void pickAndRestoreBackup(),
  },
];
