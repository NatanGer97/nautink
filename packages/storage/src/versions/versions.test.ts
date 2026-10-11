import { beforeEach, describe, expect, it } from 'vitest';

import {
  addVersion,
  countVersions,
  deleteVersion,
  listVersions,
  MAX_VERSIONS,
  putVersion,
  renameVersion,
  selectPruned,
} from './versions.ts';
import { openFreshDb } from '../../tests/fresh-db.ts';
import { RecordNotFoundError } from '../db/errors.ts';

import type { NautinkDb } from '../db/db.ts';
import type { Version } from '../db/records.ts';

let db: NautinkDb;

beforeEach(async () => {
  db = await openFreshDb();
});

async function addMany(count: number, label: (index: number) => string = () => ''): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await addVersion(db, {
      diagramId: 'd1',
      code: `code ${String(index)}`,
      kind: 'claude',
      label: label(index),
    });
  }
}

function codes(versions: Version[]): string[] {
  return versions.map((version) => version.code);
}

describe('addVersion', () => {
  it('adds a snapshot with defaults and lists newest first', async () => {
    const first = await addVersion(db, {
      diagramId: 'd1',
      code: 'a',
      kind: 'claude',
      prompt: 'draw',
    });
    const second = await addVersion(db, {
      diagramId: 'd1',
      code: 'b',
      kind: 'manual',
      label: 'Saved',
    });
    await addVersion(db, { diagramId: 'd2', code: 'other', kind: 'restore' });
    expect(first).toMatchObject({ status: 'added', pruned: [] });
    expect(first.status === 'added' && first.version).toMatchObject({
      diagramId: 'd1',
      code: 'a',
      kind: 'claude',
      label: '',
      prompt: 'draw',
    });
    expect(second.status === 'added' && second.version.label).toBe('Saved');
    expect(codes(await listVersions(db, 'd1'))).toEqual(['b', 'a']);
    expect(await countVersions(db, 'd1')).toBe(2);
  });

  it('skips code equal to the latest version', async () => {
    await addVersion(db, { diagramId: 'd1', code: 'a', kind: 'claude' });
    const again = await addVersion(db, { diagramId: 'd1', code: 'a', kind: 'manual', label: 'x' });
    expect(again).toMatchObject({ status: 'unchanged', latest: { code: 'a', label: '' } });
    expect(await countVersions(db, 'd1')).toBe(1);
  });

  it('gives each version a later createdAt than the one before', async () => {
    await addMany(5);
    const times = (await listVersions(db, 'd1')).map((version) => version.createdAt);
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(new Set(times).size).toBe(5);
  });

  it(`keeps at most ${String(MAX_VERSIONS)}, dropping the oldest unnamed first`, async () => {
    await addMany(MAX_VERSIONS, (index) => (index < 2 ? `named ${String(index)}` : ''));
    const result = await addVersion(db, { diagramId: 'd1', code: 'new', kind: 'claude' });
    expect(result.status === 'added' && codes(result.pruned)).toEqual(['code 2']);
    const kept = await listVersions(db, 'd1');
    expect(kept).toHaveLength(MAX_VERSIONS);
    expect(codes(kept)).toContain('code 0');
    expect(codes(kept)).toContain('code 1');
    expect(codes(kept)[0]).toBe('new');
  });

  it('drops the oldest named version when every older one is named', async () => {
    await addMany(MAX_VERSIONS, (index) => `named ${String(index)}`);
    const result = await addVersion(db, { diagramId: 'd1', code: 'new', kind: 'claude' });
    expect(result.status === 'added' && codes(result.pruned)).toEqual(['code 0']);
    expect(codes(await listVersions(db, 'd1'))[0]).toBe('new');
  });

  it('does not prune other diagrams', async () => {
    await addVersion(db, { diagramId: 'd2', code: 'other', kind: 'claude' });
    await addMany(MAX_VERSIONS + 1);
    expect(await countVersions(db, 'd1')).toBe(MAX_VERSIONS);
    expect(await countVersions(db, 'd2')).toBe(1);
  });
});

describe('selectPruned', () => {
  function version(index: number, label: string = ''): Version {
    return {
      id: String(index),
      diagramId: 'd',
      code: '',
      createdAt: index,
      kind: 'claude',
      label,
      prompt: '',
    };
  }

  it('prunes nothing at or under the cap', () => {
    expect(selectPruned([])).toEqual([]);
    expect(selectPruned([...Array(MAX_VERSIONS).keys()].map((index) => version(index)))).toEqual(
      [],
    );
  });

  it('drops as many as needed, oldest unnamed first, never the newest', () => {
    const newestFirst = [...Array(MAX_VERSIONS + 2).keys()].map((index) =>
      version(MAX_VERSIONS + 2 - index, index === 0 || index >= MAX_VERSIONS ? 'named' : ''),
    );
    expect(selectPruned(newestFirst).map((v) => v.createdAt)).toEqual([3, 4]);
  });
});

describe('renameVersion and deleteVersion', () => {
  it('renames, unnames and deletes a version', async () => {
    const added = await addVersion(db, { diagramId: 'd1', code: 'a', kind: 'claude' });
    const id = added.status === 'added' ? added.version.id : '';
    expect((await renameVersion(db, id, 'Release')).label).toBe('Release');
    expect((await listVersions(db, 'd1'))[0]?.label).toBe('Release');
    expect((await renameVersion(db, id, '')).label).toBe('');
    await deleteVersion(db, id);
    expect(await listVersions(db, 'd1')).toEqual([]);
  });

  it('puts a deleted version back unchanged', async () => {
    const added = await addVersion(db, { diagramId: 'd1', code: 'a', kind: 'manual', label: 'v1' });
    const version = added.status === 'added' ? added.version : undefined;
    await deleteVersion(db, version?.id ?? '');
    await putVersion(db, version!);
    expect(await listVersions(db, 'd1')).toEqual([version]);
  });

  it('throws for an unknown version', async () => {
    await expect(renameVersion(db, 'missing', 'x')).rejects.toThrow(RecordNotFoundError);
    await expect(deleteVersion(db, 'missing')).rejects.toThrow('No version with id "missing".');
  });
});
