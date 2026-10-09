import { openDB } from 'idb';

import type { Diagram, PositionMap, Version } from './records.ts';
import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb';

export const DB_NAME: string = 'nautink';
export const DB_VERSION: number = 1;

/** One editor's canvas positions for one diagram, keyed by `[diagramId, ns]`. */
export interface PositionRecord {
  diagramId: string;
  ns: string;
  positions: PositionMap;
}

export interface NautinkSchema extends DBSchema {
  diagrams: { key: string; value: Diagram };
  versions: { key: string; value: Version; indexes: { diagramId: string } };
  positions: { key: [string, string]; value: PositionRecord; indexes: { diagramId: string } };
}

export type NautinkDb = IDBPDatabase<NautinkSchema>;

export type StoreName = 'diagrams' | 'versions' | 'positions';

export const ALL_STORES: StoreName[] = ['diagrams', 'versions', 'positions'];

/** A transaction over `Names`; read-write unless `Mode` says otherwise. */
export type NautinkTx<
  Names extends ArrayLike<StoreName>,
  Mode extends IDBTransactionMode = 'readwrite',
> = IDBPTransaction<NautinkSchema, Names, Mode>;

function createStores(db: NautinkDb): void {
  db.createObjectStore('diagrams', { keyPath: 'id' });
  db.createObjectStore('versions', { keyPath: 'id' }).createIndex('diagramId', 'diagramId');
  db.createObjectStore('positions', { keyPath: ['diagramId', 'ns'] }).createIndex(
    'diagramId',
    'diagramId',
  );
}

/** Opens the database, creating its stores on first use. `name` lets tests use a fresh database. */
export async function openNautinkDb(name: string = DB_NAME): Promise<NautinkDb> {
  return openDB<NautinkSchema>(name, DB_VERSION, { upgrade: createStores });
}

/** A fresh id for a diagram or a version. */
export function createId(): string {
  return crypto.randomUUID();
}
