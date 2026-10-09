import { BACKUP_FORMAT, BACKUP_VERSION, validateBackup } from './backup-format.ts';
import { planImport } from './import-plan.ts';
import { groupPositions } from './positions.ts';

import type { Backup } from './backup-format.ts';
import type { NautinkDb, NautinkTx, PositionRecord, StoreName } from './db.ts';
import type { ImportPlan, TakenIds } from './import-plan.ts';
import type { Diagram, DiagramPositions } from './records.ts';

/** What an import added. `diagrams` are the saved records, with their final ids. */
export interface ImportResult {
  diagrams: Diagram[];
  versions: number;
  positions: number;
  skippedVersions: number;
}

const STORES: StoreName[] = ['diagrams', 'versions', 'positions'];

function positionsByDiagram(records: readonly PositionRecord[]): Record<string, DiagramPositions> {
  const diagramIds: Set<string> = new Set<string>(records.map((record) => record.diagramId));
  return Object.fromEntries(
    [...diagramIds].map((diagramId) => [
      diagramId,
      groupPositions(records.filter((record) => record.diagramId === diagramId)),
    ]),
  );
}

/** Every diagram, version and canvas position, as a Nautink backup. */
export async function exportAll(db: NautinkDb): Promise<Backup> {
  const tx: NautinkTx<StoreName[], 'readonly'> = db.transaction(STORES, 'readonly');
  const [diagrams, versions, positions] = await Promise.all([
    tx.objectStore('diagrams').getAll(),
    tx.objectStore('versions').getAll(),
    tx.objectStore('positions').getAll(),
    tx.done,
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    diagrams,
    versions,
    positions: positionsByDiagram(positions),
  };
}

async function readTakenIds(db: NautinkDb): Promise<TakenIds> {
  const [diagrams, versions] = await Promise.all([
    db.getAllKeys('diagrams'),
    db.getAllKeys('versions'),
  ]);
  return { diagrams: new Set(diagrams), versions: new Set(versions) };
}

async function writePlan(db: NautinkDb, plan: ImportPlan): Promise<void> {
  const tx: NautinkTx<StoreName[]> = db.transaction(STORES, 'readwrite');
  await Promise.all([
    ...plan.diagrams.map(async (diagram) => tx.objectStore('diagrams').put(diagram)),
    ...plan.versions.map(async (version) => tx.objectStore('versions').put(version)),
    ...plan.positions.map(async (record) => tx.objectStore('positions').put(record)),
    tx.done,
  ]);
}

/**
 * Validates a parsed backup file (Nautink or v1) and merges it into the database in one
 * transaction. Existing records are never overwritten. Throws `InvalidBackupError` before writing
 * anything when the file is not a valid backup.
 */
export async function importAll(db: NautinkDb, data: unknown): Promise<ImportResult> {
  const backup: Backup = validateBackup(data);
  const plan: ImportPlan = planImport(backup, await readTakenIds(db));
  await writePlan(db, plan);
  return {
    diagrams: plan.diagrams,
    versions: plan.versions.length,
    positions: plan.positions.length,
    skippedVersions: plan.skippedVersions,
  };
}
