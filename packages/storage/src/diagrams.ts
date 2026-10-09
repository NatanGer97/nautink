import { autoTitle } from './auto-title.ts';
import { createId } from './db.ts';
import { sortDiagrams } from './diagram-order.ts';
import { requireRecord } from './errors.ts';

import type { NautinkDb, NautinkTx, PositionRecord } from './db.ts';
import type { Diagram } from './records.ts';

type CopyStores = ('diagrams' | 'positions')[];

/** Fields a caller may change; the id is fixed. */
export type DiagramPatch = Partial<Omit<Diagram, 'id'>>;

/** A new, unsaved diagram record: v1's defaults, then `fields`. */
export function newDiagram(fields: Partial<Diagram> = {}): Diagram {
  const now: number = Date.now();
  return {
    id: createId(),
    title: '',
    titleAuto: true,
    code: '',
    view: 'preview',
    messages: [],
    sessionId: null,
    pinned: false,
    draft: '',
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

/** The record with its title recomputed when the title is automatic. */
export function withAutoTitle(diagram: Diagram): Diagram {
  return diagram.titleAuto ? { ...diagram, title: autoTitle(diagram) } : diagram;
}

/** Builds a diagram from `fields`, fills its automatic title and saves it. Throws if the id exists. */
export async function createDiagram(
  db: NautinkDb,
  fields: Partial<Diagram> = {},
): Promise<Diagram> {
  const diagram: Diagram = withAutoTitle(newDiagram(fields));
  await db.add('diagrams', diagram);
  return diagram;
}

/** The diagram with this id. Throws `RecordNotFoundError` when there is none. */
export async function getDiagram(db: NautinkDb, id: string): Promise<Diagram> {
  return requireRecord(await db.get('diagrams', id), 'diagram', id);
}

/** Every diagram, pinned first, then the most recently updated. */
export async function listDiagrams(db: NautinkDb): Promise<Diagram[]> {
  return sortDiagrams(await db.getAll('diagrams'));
}

/** Saves the record as it is, replacing any diagram with the same id. */
export async function putDiagram(db: NautinkDb, diagram: Diagram): Promise<void> {
  await db.put('diagrams', diagram);
}

/** Saves several records in one transaction. */
export async function putDiagrams(db: NautinkDb, diagrams: readonly Diagram[]): Promise<void> {
  const tx: NautinkTx<['diagrams']> = db.transaction('diagrams', 'readwrite');
  await Promise.all([...diagrams.map(async (diagram) => tx.store.put(diagram)), tx.done]);
}

// Fields whose change counts as an edit, so the diagram moves up the "most recent" list.
const CONTENT_FIELDS: readonly (keyof DiagramPatch)[] = ['code', 'messages', 'title'];

/** True when the patch changes the code, the chat or the title. */
export function isContentChange(current: Diagram, patch: DiagramPatch): boolean {
  return CONTENT_FIELDS.some((field) => field in patch && patch[field] !== current[field]);
}

/**
 * Merges `patch` into the saved diagram and returns the result. An automatic title is recomputed.
 * `updatedAt` is set to now when the code, chat or title changes, unless the patch sets it itself;
 * pinning, view, draft and session changes keep it. Throws `RecordNotFoundError` for an unknown id.
 */
export async function updateDiagram(
  db: NautinkDb,
  id: string,
  patch: DiagramPatch,
): Promise<Diagram> {
  const tx: NautinkTx<['diagrams']> = db.transaction('diagrams', 'readwrite');
  const current: Diagram = requireRecord(await tx.store.get(id), 'diagram', id);
  const touched: DiagramPatch = isContentChange(current, patch) ? { updatedAt: Date.now() } : {};
  const next: Diagram = withAutoTitle({ ...current, ...touched, ...patch, id });
  await Promise.all([tx.store.put(next), tx.done]);
  return next;
}

function copyOf(source: Diagram): Diagram {
  const title: string = source.title === '' ? 'Untitled' : source.title;
  return newDiagram({
    code: source.code,
    view: source.view,
    title: `${title} copy`,
    titleAuto: false,
  });
}

/**
 * Saves a copy with the same code, view and canvas positions, titled "<title> copy". Chat, session,
 * draft, pin and versions are not copied: a Claude session belongs to one diagram (as in v1).
 */
export async function duplicateDiagram(db: NautinkDb, id: string): Promise<Diagram> {
  const tx: NautinkTx<CopyStores> = db.transaction(['diagrams', 'positions'], 'readwrite');
  const source: Diagram = requireRecord(await tx.objectStore('diagrams').get(id), 'diagram', id);
  const copy: Diagram = copyOf(source);
  const positions: PositionRecord[] = await tx
    .objectStore('positions')
    .index('diagramId')
    .getAll(id);
  await Promise.all([
    tx.objectStore('diagrams').add(copy),
    ...positions.map(async (record) =>
      tx.objectStore('positions').put({ ...record, diagramId: copy.id }),
    ),
    tx.done,
  ]);
  return copy;
}
