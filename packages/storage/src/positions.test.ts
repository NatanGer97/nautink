import { beforeEach, describe, expect, it } from 'vitest';

import {
  deleteAllPositions,
  deletePositions,
  groupPositions,
  readAllPositions,
  readPositions,
  toPositionRecords,
  writeAllPositions,
  writePositions,
} from './positions.ts';
import { openFreshDb } from '../tests/fresh-db.ts';

import type { NautinkDb } from './db.ts';

let db: NautinkDb;

beforeEach(async () => {
  db = await openFreshDb();
});

describe('positions', () => {
  it('reads an empty map for an editor that never saved', async () => {
    expect(await readPositions(db, 'd1', 'flow')).toEqual({});
    expect(await readAllPositions(db, 'd1')).toEqual({});
  });

  it('writes and reads one namespace, keeping extra keys', async () => {
    const positions = { A: { x: 1, y: 2 }, B: { x: 3, y: 4, width: 80 } };
    await writePositions(db, { diagramId: 'd1', ns: 'flow', positions });
    expect(await readPositions(db, 'd1', 'flow')).toEqual(positions);
    expect(await readPositions(db, 'd1', 'class')).toEqual({});
    expect(await readPositions(db, 'd2', 'flow')).toEqual({});
  });

  it('replaces a namespace on write', async () => {
    await writePositions(db, { diagramId: 'd1', ns: 'flow', positions: { A: { x: 1, y: 1 } } });
    await writePositions(db, { diagramId: 'd1', ns: 'flow', positions: { B: { x: 2, y: 2 } } });
    expect(await readPositions(db, 'd1', 'flow')).toEqual({ B: { x: 2, y: 2 } });
  });

  it('writes and reads all namespaces of a diagram', async () => {
    const all = { flow: { A: { x: 1, y: 2 } }, er: { T: { x: 5, y: 6 } } };
    await writeAllPositions(db, 'd1', all);
    await writeAllPositions(db, 'd2', { flow: { Z: { x: 0, y: 0 } } });
    expect(await readAllPositions(db, 'd1')).toEqual(all);
  });

  it('deletes one namespace or all of them, only for that diagram', async () => {
    await writeAllPositions(db, 'd1', { flow: { A: { x: 1, y: 2 } }, er: { T: { x: 5, y: 6 } } });
    await writeAllPositions(db, 'd2', { flow: { Z: { x: 0, y: 0 } } });
    await deletePositions(db, 'd1', 'flow');
    expect(await readAllPositions(db, 'd1')).toEqual({ er: { T: { x: 5, y: 6 } } });
    await deleteAllPositions(db, 'd1');
    expect(await readAllPositions(db, 'd1')).toEqual({});
    expect(await readAllPositions(db, 'd2')).toEqual({ flow: { Z: { x: 0, y: 0 } } });
  });

  it('converts between records and the namespace map', () => {
    const all = { flow: { A: { x: 1, y: 2 } } };
    const records = toPositionRecords('d1', all);
    expect(records).toEqual([{ diagramId: 'd1', ns: 'flow', positions: { A: { x: 1, y: 2 } } }]);
    expect(groupPositions(records)).toEqual(all);
  });
});
