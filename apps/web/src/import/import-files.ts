import { InvalidBackupError } from '@nautink/storage/errors';

import { countsMessage, IMPORT_ACCEPT, parseBackupText, routeImport } from './import-routing.ts';
import { showError, showNotice } from '../lib/notices.ts';
import { pickFiles } from '../lib/pick-files.ts';
import { downloadTextFile } from '../workspace/default-workspace-deps.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';
import { errorMessage } from '../workspace/workspace-context.ts';

import type { ImportRoute } from './import-routing.ts';
import type { ImportResult } from '@nautink/storage/backup';
import type { Backup } from '@nautink/storage/backup-format';
import type { TextFile } from '@nautink/storage/diagram-files';
import type { Diagram } from '@nautink/storage/records';

/** Backups are indented, so they can be read and diffed. */
const JSON_INDENT: number = 2;

/** The files' text, for the import rules. */
export async function readTextFiles(files: readonly File[]): Promise<TextFile[]> {
  return Promise.all(files.map(async (file) => ({ name: file.name, text: await file.text() })));
}

/** Restores one backup file (Nautink or v1) and says how much it added. */
export async function restoreBackupFile(file: TextFile): Promise<void> {
  try {
    const data: unknown = parseBackupText(file);
    const result: ImportResult = await useWorkspaceStore.getState().importBackup(data);
    showNotice(
      countsMessage('Restored', { diagrams: result.diagrams.length, versions: result.versions }),
    );
  } catch (err) {
    const reason: string = err instanceof InvalidBackupError ? err.message : errorMessage(err);
    showError(`Could not restore ${file.name}. ${reason}`);
  }
}

async function createFromDrafts(route: ImportRoute): Promise<void> {
  if (route.drafts.length === 0) {
    return;
  }
  const created: Diagram[] = await useWorkspaceStore.getState().createDiagrams(route.drafts);
  if (created.length > 0) {
    showNotice(countsMessage('Imported', { diagrams: created.length }));
  }
}

/** Imports dropped or picked files: diagrams from Mermaid and Markdown, backups from JSON. */
export async function importFiles(files: readonly File[]): Promise<void> {
  const route: ImportRoute = routeImport(await readTextFiles(files));
  for (const backup of route.backups) {
    await restoreBackupFile(backup);
  }
  await createFromDrafts(route);
  if (route.skipped.length > 0) {
    showNotice(`No Mermaid diagram found in ${route.skipped.join(', ')}`);
  }
}

/** "Open file…": picks Mermaid, Markdown or backup files and imports them. */
export async function openFiles(): Promise<void> {
  await importFiles(await pickFiles({ accept: IMPORT_ACCEPT, isMultiple: true }));
}

/** "Restore backup": picks one backup file and restores it. */
export async function pickAndRestoreBackup(): Promise<void> {
  const [file] = await pickFiles({ accept: '.json,application/json', isMultiple: false });
  if (file !== undefined) {
    const [text] = await readTextFiles([file]);
    await restoreBackupFile(text ?? { name: file.name, text: '' });
  }
}

/** "Back up all": downloads every diagram, version and position as one JSON file. */
export async function backUpAll(): Promise<void> {
  try {
    const backup: Backup = await useWorkspaceStore.getState().exportBackup();
    const day: string = backup.exportedAt.slice(0, 'yyyy-mm-dd'.length);
    downloadTextFile({
      fileName: `nautink-backup-${day}.json`,
      text: JSON.stringify(backup, null, JSON_INDENT),
    });
    showNotice(
      countsMessage('Backed up', {
        diagrams: backup.diagrams.length,
        versions: backup.versions.length,
      }),
    );
  } catch (err) {
    showError(`Could not back up. ${errorMessage(err)}`);
  }
}
