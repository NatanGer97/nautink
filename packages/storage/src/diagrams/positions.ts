import type { NautinkDb, NautinkTx, PositionRecord } from '../db/db.ts';
import type { DiagramPositions, PositionMap } from '../db/records.ts';

// Canvas positions per diagram and editor namespace (`flow`, `class`, …). Mermaid lays diagrams out
// itself, so these exist only for the visual editors. v1 kept them in localStorage under
// `mc.positions.<diagramId>.<ns>`; v2 keeps them in IndexedDB (PRD §7.3).

/** Namespace → positions, from the records of one diagram. */
export function groupPositions(records: readonly PositionRecord[]): DiagramPositions {
  return Object.fromEntries(records.map((record) => [record.ns, record.positions]));
}

/** One record per namespace, ready to store for `diagramId`. */
export function toPositionRecords(
  diagramId: string,
  positions: DiagramPositions,
): PositionRecord[] {
  return Object.entries(positions).map(([ns, map]) => ({ diagramId, ns, positions: map }));
}

/** One editor's positions for a diagram. An editor that never saved any gets an empty map. */
export async function readPositions(
  db: NautinkDb,
  diagramId: string,
  ns: string,
): Promise<PositionMap> {
  const record: PositionRecord | undefined = await db.get('positions', [diagramId, ns]);
  return record?.positions ?? {};
}

/** Every editor's positions for a diagram, by namespace. */
export async function readAllPositions(
  db: NautinkDb,
  diagramId: string,
): Promise<DiagramPositions> {
  return groupPositions(await db.getAllFromIndex('positions', 'diagramId', diagramId));
}

/** Replaces one editor's positions for a diagram. */
export async function writePositions(db: NautinkDb, record: PositionRecord): Promise<void> {
  await db.put('positions', record);
}

/** Replaces the positions of every namespace in `positions`; other namespaces stay as they are. */
export async function writeAllPositions(
  db: NautinkDb,
  diagramId: string,
  positions: DiagramPositions,
): Promise<void> {
  const tx: NautinkTx<['positions']> = db.transaction('positions', 'readwrite');
  const writes: Promise<unknown>[] = toPositionRecords(diagramId, positions).map(async (record) =>
    tx.store.put(record),
  );
  await Promise.all([...writes, tx.done]);
}

/** Forgets one editor's positions for a diagram. */
export async function deletePositions(db: NautinkDb, diagramId: string, ns: string): Promise<void> {
  await db.delete('positions', [diagramId, ns]);
}

/** Forgets every editor's positions for a diagram. */
export async function deleteAllPositions(db: NautinkDb, diagramId: string): Promise<void> {
  const tx: NautinkTx<['positions']> = db.transaction('positions', 'readwrite');
  const keys: [string, string][] = await tx.store.index('diagramId').getAllKeys(diagramId);
  await Promise.all([...keys.map(async (key) => tx.store.delete(key)), tx.done]);
}
