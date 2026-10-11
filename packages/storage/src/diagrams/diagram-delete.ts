import { groupPositions, toPositionRecords } from './positions.ts';
import { requireRecord } from '../db/errors.ts';
import { sortVersions } from '../versions/version-order.ts';

import type { NautinkDb, NautinkTx, PositionRecord, StoreName } from '../db/db.ts';
import type { Diagram, DiagramPositions, Version } from '../db/records.ts';

/** Everything a delete removed, so an undo can put it back with `restoreDiagram`. */
export interface DeletedDiagram {
  diagram: Diagram;
  versions: Version[];
  positions: DiagramPositions;
}

const STORES: StoreName[] = ['diagrams', 'versions', 'positions'];

/**
 * Deletes a diagram with its versions and canvas positions in one transaction, and returns what
 * was removed. Throws `RecordNotFoundError` for an unknown id.
 */
export async function deleteDiagram(db: NautinkDb, id: string): Promise<DeletedDiagram> {
  const tx: NautinkTx<StoreName[]> = db.transaction(STORES, 'readwrite');
  const diagram: Diagram = requireRecord(await tx.objectStore('diagrams').get(id), 'diagram', id);
  const versions: Version[] = await tx.objectStore('versions').index('diagramId').getAll(id);
  const positions: PositionRecord[] = await tx
    .objectStore('positions')
    .index('diagramId')
    .getAll(id);
  await Promise.all([
    tx.objectStore('diagrams').delete(id),
    ...versions.map(async (version) => tx.objectStore('versions').delete(version.id)),
    ...positions.map(async (record) =>
      tx.objectStore('positions').delete([record.diagramId, record.ns]),
    ),
    tx.done,
  ]);
  return { diagram, versions: sortVersions(versions), positions: groupPositions(positions) };
}

/** Puts a deleted diagram back with its versions and positions (undo-delete), in one transaction. */
export async function restoreDiagram(db: NautinkDb, deleted: DeletedDiagram): Promise<void> {
  const tx: NautinkTx<StoreName[]> = db.transaction(STORES, 'readwrite');
  const records: PositionRecord[] = toPositionRecords(deleted.diagram.id, deleted.positions);
  await Promise.all([
    tx.objectStore('diagrams').put(deleted.diagram),
    ...deleted.versions.map(async (version) => tx.objectStore('versions').put(version)),
    ...records.map(async (record) => tx.objectStore('positions').put(record)),
    tx.done,
  ]);
}
