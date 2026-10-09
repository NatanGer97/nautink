import { beforeEach, describe, expect, it } from 'vitest';

import { deleteDiagram, restoreDiagram } from './diagram-delete.ts';
import {
  createDiagram,
  duplicateDiagram,
  getDiagram,
  listDiagrams,
  newDiagram,
  putDiagram,
  putDiagrams,
  updateDiagram,
} from './diagrams.ts';
import { RecordNotFoundError } from './errors.ts';
import { readAllPositions, writeAllPositions } from './positions.ts';
import { openFreshDb } from '../tests/fresh-db.ts';

import type { NautinkDb } from './db.ts';
import type { Version } from './records.ts';

let db: NautinkDb;

beforeEach(async () => {
  db = await openFreshDb();
});

function version(id: string, diagramId: string, createdAt: number): Version {
  return { id, diagramId, code: id, createdAt, kind: 'manual', label: '', prompt: '' };
}

describe('newDiagram', () => {
  it('fills v1 defaults plus view and draft', () => {
    const diagram = newDiagram();
    expect(diagram).toMatchObject({
      title: '',
      titleAuto: true,
      code: '',
      view: 'preview',
      messages: [],
      sessionId: null,
      pinned: false,
      draft: '',
    });
    expect(diagram.id).not.toBe('');
    expect(diagram.updatedAt).toBe(diagram.createdAt);
    expect(newDiagram().id).not.toBe(diagram.id);
  });

  it('lets fields override the defaults', () => {
    expect(newDiagram({ id: 'x', code: 'pie', view: 'split' })).toMatchObject({
      id: 'x',
      code: 'pie',
      view: 'split',
    });
  });
});

describe('diagram CRUD', () => {
  it('creates with an automatic title and reads it back', async () => {
    const created = await createDiagram(db, { code: 'pie title Pets' });
    expect(created.title).toBe('Pets');
    expect(await getDiagram(db, created.id)).toEqual(created);
  });

  it('keeps a manual title on create', async () => {
    const created = await createDiagram(db, {
      code: 'pie title Pets',
      title: 'Mine',
      titleAuto: false,
    });
    expect(created.title).toBe('Mine');
  });

  it('refuses to create over an existing id', async () => {
    await createDiagram(db, { id: 'same' });
    await expect(createDiagram(db, { id: 'same' })).rejects.toThrow();
  });

  it('throws a named error for an unknown id', async () => {
    await expect(getDiagram(db, 'missing')).rejects.toThrow(RecordNotFoundError);
    await expect(getDiagram(db, 'missing')).rejects.toThrow('No diagram with id "missing".');
  });

  it('lists pinned first, then the most recently updated', async () => {
    await putDiagrams(db, [
      newDiagram({ id: 'old', updatedAt: 1 }),
      newDiagram({ id: 'new', updatedAt: 3 }),
      newDiagram({ id: 'pinned', updatedAt: 0, pinned: true }),
      newDiagram({ id: 'mid', updatedAt: 2 }),
    ]);
    expect((await listDiagrams(db)).map((d) => d.id)).toEqual(['pinned', 'new', 'mid', 'old']);
  });

  it('puts a record as it is', async () => {
    const diagram = newDiagram({ id: 'p', title: 'Kept', titleAuto: true });
    await putDiagram(db, diagram);
    expect(await getDiagram(db, 'p')).toEqual(diagram);
  });

  it('updates with a patch, recomputing an automatic title only', async () => {
    const created = await createDiagram(db, { code: 'pie title A', updatedAt: 5 });
    const updated = await updateDiagram(db, created.id, { code: 'pie title B', draft: 'hi' });
    expect(updated).toMatchObject({ code: 'pie title B', title: 'B', draft: 'hi', updatedAt: 5 });
    const renamed = await updateDiagram(db, created.id, { title: 'Named', titleAuto: false });
    const recoded = await updateDiagram(db, created.id, { code: 'pie title C', updatedAt: 9 });
    expect(renamed.title).toBe('Named');
    expect(recoded).toMatchObject({ title: 'Named', updatedAt: 9 });
    expect(await getDiagram(db, created.id)).toEqual(recoded);
  });

  it('refuses to update an unknown id', async () => {
    await expect(updateDiagram(db, 'missing', { pinned: true })).rejects.toThrow(
      RecordNotFoundError,
    );
  });
});

describe('duplicateDiagram', () => {
  it('copies code, view and positions, not chat, pin or versions', async () => {
    const source = await createDiagram(db, {
      code: 'flowchart TD\n  A --> B',
      title: 'Login',
      titleAuto: false,
      view: 'edit',
      messages: [{ role: 'user', text: 'hi' }],
      sessionId: 'session-1',
      pinned: true,
      draft: 'unsent',
    });
    await writeAllPositions(db, source.id, { flow: { A: { x: 1, y: 2 } } });
    await db.put('versions', version('v1', source.id, 1));
    const copy = await duplicateDiagram(db, source.id);
    expect(copy.id).not.toBe(source.id);
    expect(copy).toMatchObject({
      code: source.code,
      view: 'edit',
      title: 'Login copy',
      titleAuto: false,
      messages: [],
      sessionId: null,
      pinned: false,
      draft: '',
    });
    expect(await getDiagram(db, copy.id)).toEqual(copy);
    expect(await readAllPositions(db, copy.id)).toEqual({ flow: { A: { x: 1, y: 2 } } });
    expect(await readAllPositions(db, source.id)).toEqual({ flow: { A: { x: 1, y: 2 } } });
    expect(await db.getAllFromIndex('versions', 'diagramId', copy.id)).toEqual([]);
  });

  it('names an untitled copy', async () => {
    const source = await createDiagram(db, { title: '', titleAuto: false });
    expect((await duplicateDiagram(db, source.id)).title).toBe('Untitled copy');
  });

  it('refuses an unknown id', async () => {
    await expect(duplicateDiagram(db, 'missing')).rejects.toThrow(RecordNotFoundError);
  });
});

describe('deleteDiagram and restoreDiagram', () => {
  it('removes the diagram, its versions and positions, and restores them', async () => {
    const kept = await createDiagram(db);
    const doomed = await createDiagram(db, { code: 'pie' });
    await db.put('versions', version('a', doomed.id, 1));
    await db.put('versions', version('b', doomed.id, 2));
    await db.put('versions', version('other', kept.id, 1));
    await writeAllPositions(db, doomed.id, { flow: { A: { x: 1, y: 2 } }, er: {} });
    await writeAllPositions(db, kept.id, { flow: { K: { x: 0, y: 0 } } });
    const deleted = await deleteDiagram(db, doomed.id);
    expect(deleted.diagram).toEqual(doomed);
    expect(deleted.versions.map((v) => v.id)).toEqual(['b', 'a']);
    expect(deleted.positions).toEqual({ flow: { A: { x: 1, y: 2 } }, er: {} });
    expect((await listDiagrams(db)).map((d) => d.id)).toEqual([kept.id]);
    expect((await db.getAll('versions')).map((v) => v.id)).toEqual(['other']);
    expect(await readAllPositions(db, doomed.id)).toEqual({});
    expect(await readAllPositions(db, kept.id)).toEqual({ flow: { K: { x: 0, y: 0 } } });
    await restoreDiagram(db, deleted);
    expect(await getDiagram(db, doomed.id)).toEqual(doomed);
    expect((await db.getAllFromIndex('versions', 'diagramId', doomed.id)).length).toBe(2);
    expect(await readAllPositions(db, doomed.id)).toEqual(deleted.positions);
  });

  it('refuses to delete an unknown id', async () => {
    await expect(deleteDiagram(db, 'missing')).rejects.toThrow(RecordNotFoundError);
  });
});
