import { beforeEach, describe, expect, it } from 'vitest';

import { BACKUP_FORMAT, BACKUP_VERSION, validateBackup } from './backup-format.ts';
import { exportAll, importAll } from './backup.ts';
import { createDiagram, getDiagram, listDiagrams } from './diagrams.ts';
import { InvalidBackupError } from './errors.ts';
import { readAllPositions, writeAllPositions } from './positions.ts';
import { addVersion, listVersions } from './versions.ts';
import v1Fixture from '../tests/fixtures/v1-backup.json' with { type: 'json' };
import { openFreshDb } from '../tests/fresh-db.ts';

import type { Backup } from './backup-format.ts';
import type { NautinkDb } from './db.ts';

let db: NautinkDb;

beforeEach(async () => {
  db = await openFreshDb();
});

const LOGIN_ID = '0f8c1d2e-5b7a-4c3e-9d1f-2a6b8c4e0d11';
const PIE_ID = '7a1b2c3d-4e5f-4061-8a9b-0c1d2e3f4a5b';
const ORDERS_ID = 'c4d5e6f7-0a1b-4c2d-9e3f-4a5b6c7d8e9f';

async function seed(target: NautinkDb): Promise<void> {
  const login = await createDiagram(target, {
    code: 'flowchart TD\n  A --> B',
    view: 'split',
    pinned: true,
    draft: 'unsent',
    messages: [{ role: 'user', text: 'login flow' }],
    sessionId: 's1',
  });
  const pie = await createDiagram(target, { code: 'pie title Pets' });
  await addVersion(target, {
    diagramId: login.id,
    code: 'flowchart TD',
    kind: 'manual',
    label: 'Before Claude',
  });
  await addVersion(target, {
    diagramId: login.id,
    code: login.code,
    kind: 'claude',
    prompt: 'login flow',
  });
  await addVersion(target, { diagramId: pie.id, code: pie.code, kind: 'restore' });
  await writeAllPositions(target, login.id, {
    flow: { A: { x: 1, y: 2 } },
    class: { C: { x: 3, y: 4 } },
  });
}

function withoutTimestamp(backup: Backup): Backup {
  return { ...backup, exportedAt: '' };
}

describe('exportAll', () => {
  it('exports an empty workspace', async () => {
    const backup = await exportAll(db);
    expect(backup).toMatchObject({
      format: 'nautink-backup',
      version: 1,
      diagrams: [],
      versions: [],
      positions: {},
    });
    expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
  });

  it('exports diagrams, versions and positions by diagram', async () => {
    await seed(db);
    const backup = await exportAll(db);
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.diagrams).toHaveLength(2);
    expect(backup.versions).toHaveLength(3);
    const login = backup.diagrams.find((diagram) => diagram.pinned);
    expect(backup.positions).toEqual({
      [login!.id]: { flow: { A: { x: 1, y: 2 } }, class: { C: { x: 3, y: 4 } } },
    });
  });
});

describe('export → import round trip', () => {
  it('restores an identical workspace into an empty database', async () => {
    await seed(db);
    const backup = await exportAll(db);
    const target = await openFreshDb();
    const result = await importAll(target, JSON.parse(JSON.stringify(backup)));
    expect(result).toMatchObject({ versions: 3, positions: 2, skippedVersions: 0 });
    expect(result.diagrams.map((diagram) => diagram.id).sort()).toEqual(
      backup.diagrams.map((diagram) => diagram.id).sort(),
    );
    expect(withoutTimestamp(await exportAll(target))).toEqual(withoutTimestamp(backup));
  });

  it('keeps which agent wrote each reply and version, and owns the session', async () => {
    const diagram = await createDiagram(db, {
      code: 'flowchart TD\n  A --> B',
      messages: [
        { role: 'user', text: 'draw it' },
        { role: 'assistant', text: 'Done.', agent: 'codex' },
      ],
      sessionId: 't-1',
      sessionAgent: 'codex',
    });
    await addVersion(db, {
      diagramId: diagram.id,
      code: diagram.code,
      kind: 'claude',
      agent: 'codex',
    });
    const target = await openFreshDb();
    await importAll(target, JSON.parse(JSON.stringify(await exportAll(db))));
    const restored = await getDiagram(target, diagram.id);
    expect(restored.sessionAgent).toBe('codex');
    expect(restored.messages[1]?.agent).toBe('codex');
    expect((await listVersions(target, diagram.id))[0]?.agent).toBe('codex');
  });

  it('rejects an unknown agent and names the field', async () => {
    const v2 = await exportAll(db);
    const message = { role: 'assistant', text: 'Hi', agent: 'gpt' };
    const diagram = { ...v1Fixture.diagrams[0], draft: '', view: 'edit', messages: [message] };
    expect(() => validateBackup({ ...v2, diagrams: [diagram] })).toThrow(/agent/);
  });

  it('gives clashing ids new ids and keeps the existing records', async () => {
    await seed(db);
    const before = await exportAll(db);
    const result = await importAll(db, before);
    const oldIds = new Set(before.diagrams.map((diagram) => diagram.id));
    expect(result.diagrams.every((diagram) => !oldIds.has(diagram.id))).toBe(true);
    expect(await listDiagrams(db)).toHaveLength(4);
    const copy = result.diagrams.find((diagram) => diagram.pinned)!;
    expect(copy.draft).toBe('unsent');
    expect((await listVersions(db, copy.id)).map((version) => version.label)).toEqual([
      '',
      'Before Claude',
    ]);
    expect(await readAllPositions(db, copy.id)).toEqual({
      flow: { A: { x: 1, y: 2 } },
      class: { C: { x: 3, y: 4 } },
    });
    const after = await exportAll(db);
    expect(after.versions).toHaveLength(6);
    expect(new Set(after.versions.map((version) => version.id)).size).toBe(6);
  });

  it('gives a diagram id repeated inside one backup a new id', async () => {
    const backup = await exportAll(db);
    const diagram = await createDiagram(await openFreshDb(), { code: 'pie' });
    const result = await importAll(db, {
      ...backup,
      diagrams: [diagram, { ...diagram, code: 'gantt' }],
    });
    expect(result.diagrams[0]!.id).toBe(diagram.id);
    expect(result.diagrams[1]!.id).not.toBe(diagram.id);
    expect((await getDiagram(db, result.diagrams[1]!.id)).code).toBe('gantt');
  });
});

describe('v1 backups', () => {
  it('imports a real-shaped Mermaid Chat backup', async () => {
    const result = await importAll(db, v1Fixture);
    expect(result).toMatchObject({ versions: 3, positions: 2, skippedVersions: 1 });
    const login = await getDiagram(db, LOGIN_ID);
    expect(login).toMatchObject({
      title: 'Login flow',
      titleAuto: true,
      view: 'edit',
      pinned: true,
      draft: '',
      sessionId: '5d3e8f6a-1b2c-4d5e-8f9a-0b1c2d3e4f5a',
      createdAt: 1759300000000,
      updatedAt: 1759310000000,
    });
    expect(login.messages).toHaveLength(4);
    expect(login.messages[1]).toMatchObject({
      tools: ['Read', 'Grep'],
      meta: { durationMs: 8123 },
    });
    expect((await getDiagram(db, PIE_ID)).view).toBe('preview');
    expect((await listVersions(db, LOGIN_ID)).map((version) => version.kind)).toEqual([
      'claude',
      'manual',
    ]);
    expect((await listVersions(db, ORDERS_ID))[0]).toMatchObject({ id: 'v-0003', kind: 'restore' });
    expect((await readAllPositions(db, LOGIN_ID)).flow?.D).toEqual({ x: 260, y: 300 });
    expect(await readAllPositions(db, ORDERS_ID)).toEqual({
      er: { CUSTOMER: { x: 0, y: 0 }, ORDER: { x: 320, y: 0 } },
    });
    expect(await readAllPositions(db, 'deleted-diagram')).toEqual({});
  });

  it('fills the fields v1 itself defaults when a minimal v1 backup leaves them out', () => {
    const backup = validateBackup({
      format: 'mermaid-chat-backup',
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      diagrams: [
        { id: 'a', code: 'pie' },
        { id: 'b', code: 'gantt', title: 'Plan' },
      ],
      versions: null,
    });
    expect(backup.diagrams[0]).toMatchObject({
      id: 'a',
      title: '',
      titleAuto: true,
      view: 'preview',
      messages: [],
      sessionId: null,
      pinned: false,
      draft: '',
    });
    expect(backup.diagrams[1]).toMatchObject({ title: 'Plan', titleAuto: false });
    expect(typeof backup.diagrams[0]!.createdAt).toBe('number');
    expect(backup.versions).toEqual([]);
    expect(backup.positions).toEqual({});
  });

  it('defaults a v1 version kind to manual', () => {
    const backup = validateBackup({
      format: 'mermaid-chat-backup',
      version: 1,
      exportedAt: '',
      diagrams: [{ id: 'a', code: 'pie' }],
      versions: [{ id: 'v', diagramId: 'a', code: 'pie' }],
    });
    expect(backup.versions[0]).toMatchObject({ kind: 'manual', label: '', prompt: '' });
  });
});

describe('invalid backups', () => {
  const v2: Backup = {
    format: 'nautink-backup',
    version: 1,
    exportedAt: '2026-10-09T00:00:00.000Z',
    diagrams: [],
    versions: [],
    positions: {},
  };

  it.each([null, [], 'backup', 42, {}, { format: 'nautink-backup' }])(
    'rejects %j, which is not a backup',
    (data) => {
      expect(() => validateBackup(data)).toThrow('This file is not a backup');
    },
  );

  it('rejects an unknown format', () => {
    expect(() => validateBackup({ format: 'drawio', version: 1 })).toThrow(
      'Unknown backup format "drawio"',
    );
  });

  it('rejects a newer or unknown format version', () => {
    expect(() => validateBackup({ ...v2, version: 2 })).toThrow('newer than this app supports (1)');
    expect(() => validateBackup({ ...v1Fixture, version: 3 })).toThrow(
      'newer than this app supports',
    );
    expect(() => validateBackup({ ...v2, version: 0 })).toThrow('version 0 is not supported');
  });

  it('rejects records with a wrong shape and names the field', () => {
    const badView = { ...v2, diagrams: [{ ...v1Fixture.diagrams[0], draft: '', view: 'code' }] };
    expect(() => validateBackup(badView)).toThrow(InvalidBackupError);
    expect(() => validateBackup(badView)).toThrow(/diagrams\[0\]/);
    expect(() => validateBackup({ ...v2, versions: undefined })).toThrow('The backup is not valid');
    expect(() => validateBackup({ ...v1Fixture, diagrams: [{ id: 'x' }] })).toThrow(/code/);
    expect(() =>
      validateBackup({ ...v1Fixture, diagrams: [{ id: 'x', code: '', mode: 'other' }] }),
    ).toThrow(/mode/);
    expect(() => validateBackup({ ...v1Fixture, versions: {} })).toThrow(/versions/);
    expect(() =>
      validateBackup({ ...v1Fixture, positions: { a: { flow: { n: { x: 'left' } } } } }),
    ).toThrow(InvalidBackupError);
  });

  it('accepts a valid Nautink backup unchanged', () => {
    expect(validateBackup(v2)).toEqual(v2);
  });

  it('writes nothing when the import is invalid', async () => {
    await expect(
      importAll(db, { ...v1Fixture, diagrams: [...v1Fixture.diagrams, { id: 7 }] }),
    ).rejects.toThrow(InvalidBackupError);
    expect(await listDiagrams(db)).toEqual([]);
  });
});
