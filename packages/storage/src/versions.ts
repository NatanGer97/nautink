import { createId } from './db.ts';
import { requireRecord } from './errors.ts';
import { sortVersions } from './version-order.ts';

import type { NautinkDb, NautinkTx } from './db.ts';
import type { Version, VersionKind } from './records.ts';

/** Versions kept per diagram; adding one more prunes the oldest unnamed version first. */
export const MAX_VERSIONS: number = 50;

/** What a caller gives to snapshot a diagram. `label` names the version; `prompt` is Claude's ask. */
export interface NewVersion {
  diagramId: string;
  code: string;
  kind: VersionKind;
  label?: string;
  prompt?: string;
}

/** `added` with the new version and what was pruned, or `unchanged` when the code equals the latest. */
export type AddVersionResult =
  | { status: 'added'; version: Version; pruned: Version[] }
  | { status: 'unchanged'; latest: Version };

/**
 * The versions to drop so that `newestFirst` (the new version first) keeps `MAX_VERSIONS`. The new
 * version is never dropped; the oldest unnamed go first, then the oldest named (as v1).
 */
export function selectPruned(newestFirst: readonly Version[]): Version[] {
  const excess: number = newestFirst.length - MAX_VERSIONS;
  if (excess <= 0) {
    return [];
  }
  const oldestFirst: Version[] = newestFirst.slice(1).reverse();
  const unnamed: Version[] = oldestFirst.filter((version) => version.label === '');
  const named: Version[] = oldestFirst.filter((version) => version.label !== '');
  return [...unnamed, ...named].slice(0, excess);
}

function buildVersion(input: NewVersion, latest: Version | undefined): Version {
  return {
    id: createId(),
    diagramId: input.diagramId,
    code: input.code,
    kind: input.kind,
    label: input.label ?? '',
    prompt: input.prompt ?? '',
    // Strictly after the latest, so "newest first" holds even within one millisecond.
    createdAt: Math.max(Date.now(), (latest?.createdAt ?? 0) + 1),
  };
}

/** Snapshots a diagram's code unless it equals the latest version, then prunes to `MAX_VERSIONS`. */
export async function addVersion(db: NautinkDb, input: NewVersion): Promise<AddVersionResult> {
  const tx: NautinkTx<['versions']> = db.transaction('versions', 'readwrite');
  const existing: Version[] = sortVersions(
    await tx.store.index('diagramId').getAll(input.diagramId),
  );
  const [latest] = existing;
  if (latest?.code === input.code) {
    await tx.done;
    return { status: 'unchanged', latest };
  }
  const version: Version = buildVersion(input, latest);
  const pruned: Version[] = selectPruned([version, ...existing]);
  await Promise.all([
    tx.store.add(version),
    ...pruned.map(async (old) => tx.store.delete(old.id)),
    tx.done,
  ]);
  return { status: 'added', version, pruned };
}

/** A diagram's versions, newest first. */
export async function listVersions(db: NautinkDb, diagramId: string): Promise<Version[]> {
  return sortVersions(await db.getAllFromIndex('versions', 'diagramId', diagramId));
}

/** How many versions a diagram has. */
export async function countVersions(db: NautinkDb, diagramId: string): Promise<number> {
  return db.countFromIndex('versions', 'diagramId', diagramId);
}

/** Sets a version's label; an empty label makes it unnamed again. Throws for an unknown id. */
export async function renameVersion(db: NautinkDb, id: string, label: string): Promise<Version> {
  const tx: NautinkTx<['versions']> = db.transaction('versions', 'readwrite');
  const renamed: Version = { ...requireRecord(await tx.store.get(id), 'version', id), label };
  await Promise.all([tx.store.put(renamed), tx.done]);
  return renamed;
}

/** Saves a version record as it is, such as one put back after a delete is undone. */
export async function putVersion(db: NautinkDb, version: Version): Promise<void> {
  await db.put('versions', version);
}

/** Deletes one version. Throws for an unknown id. */
export async function deleteVersion(db: NautinkDb, id: string): Promise<void> {
  const tx: NautinkTx<['versions']> = db.transaction('versions', 'readwrite');
  requireRecord(await tx.store.get(id), 'version', id);
  await Promise.all([tx.store.delete(id), tx.done]);
}
