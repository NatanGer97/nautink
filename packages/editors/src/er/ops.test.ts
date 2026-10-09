import { describe, expect, it } from 'vitest';

import { emptyModel, parse } from './model.ts';
import {
  addAttribute,
  addEntity,
  addRel,
  deleteItems,
  moveAttribute,
  newAttribute,
  removeAttribute,
  renameEntity,
  reverseRel,
  setEntityGroup,
  toggleKey,
  ungroup,
  updateAttribute,
  updateEntity,
  updateGroup,
  updateRel,
} from './ops.ts';
import { ER_FIXTURES } from '../../tests/fixtures/er.ts';
import { parseOk } from '../../tests/parse-ok.ts';

import type { ErEntity, ErModel } from './model.ts';

const read = async (code: string): Promise<ErModel> => parseOk(parse, code);
const entity = (model: ErModel, name: string): ErEntity =>
  model.entities.find((item) => item.name === name)!;
const shop = async (): Promise<ErModel> =>
  read(
    `${ER_FIXTURES.subgraphs!}    style CUSTOMER fill:#f00\n    CUSTOMER ||--o{ CUSTOMER : refers\n`,
  );

describe('entities', () => {
  it('adds an entity, optionally inside a subgraph', async () => {
    const model = await shop();
    const added = addEntity(model, { name: 'NEW' }, 'Billing');
    expect(entity(added, 'NEW')).toEqual({ name: 'NEW', alias: '', attributes: [], classes: [] });
    expect(added.subgraphs[0]!.members).toEqual(['INVOICE', 'NEW']);
    expect(addEntity(model, { name: 'TOP' }).subgraphs).toEqual(model.subgraphs);
  });

  it('cleans an alias and patches other fields as given', async () => {
    const model = await shop();
    expect(entity(updateEntity(model, 'ORDER', { alias: ' 50%\nmore\\ ' }), 'ORDER').alias).toBe(
      '50 more',
    );
    expect(entity(updateEntity(model, 'ORDER', { classes: ['hot'] }), 'ORDER').classes).toEqual([
      'hot',
    ]);
  });

  it('renames an entity everywhere it is referenced', async () => {
    const renamed = renameEntity(await shop(), 'CUSTOMER', ' CLIENT" ')!;
    expect(renamed.rels.map((rel) => rel.id)).toEqual([
      'R_CLIENT_ORDER_0',
      'R_ORDER_INVOICE_0',
      'R_CLIENT_CLIENT_0',
    ]);
    expect(renamed.extra).toEqual(['style CLIENT fill:#f00']);
    const grouped = renameEntity(await shop(), 'ORDER', 'PURCHASE')!;
    expect(grouped.subgraphs[1]!.members).toEqual(['PURCHASE', 'Billing']);
  });

  it('refuses an empty, unchanged or taken name', async () => {
    const model = await shop();
    expect(renameEntity(model, 'ORDER', ' % ')).toBeNull();
    expect(renameEntity(model, 'ORDER', 'ORDER')).toBeNull();
    expect(renameEntity(model, 'ORDER', 'CUSTOMER')).toBeNull();
    expect(renameEntity(model, 'ORDER', 'Sales')).toBeNull();
  });

  it('moves an entity between subgraphs', async () => {
    const model = await shop();
    expect(
      setEntityGroup(model, 'ORDER', 'Billing').subgraphs.map((subgraph) => subgraph.members),
    ).toEqual([['INVOICE', 'ORDER'], ['Billing']]);
    expect(setEntityGroup(model, 'ORDER', null).subgraphs[1]!.members).toEqual(['Billing']);
  });
});

describe('relationships', () => {
  it('adds a one-to-many relationship with the next id', async () => {
    const { model, id } = addRel(await shop(), { from: 'CUSTOMER', to: 'ORDER' });
    expect(id).toBe('R_CUSTOMER_ORDER_1');
    expect(model.rels.at(-1)).toEqual({
      id,
      from: 'CUSTOMER',
      to: 'ORDER',
      fromCard: 'ONLY_ONE',
      toCard: 'ZERO_OR_MORE',
      isIdentifying: true,
      label: 'relates',
    });
    expect(
      addRel(emptyModel(), { from: 'A', to: 'B', isIdentifying: false }).model.rels[0]!
        .isIdentifying,
    ).toBe(false);
  });

  it('patches a relationship, flattening a multi-line label', async () => {
    const model = await shop();
    expect(updateRel(model, 'R_CUSTOMER_ORDER_0', { label: 'a\nb' }).rels[0]!.label).toBe('a b');
    expect(
      updateRel(model, 'R_CUSTOMER_ORDER_0', { isIdentifying: false }).rels[0]!.isIdentifying,
    ).toBe(false);
  });

  it('reverses a relationship, keeping a parent marker on the left', async () => {
    const model = await read('erDiagram\n    P u--o{ Q : parent\n');
    const { model: reversed, id } = reverseRel(model, 'R_P_Q_0');
    expect(id).toBe('R_Q_P_0');
    expect(reversed.rels[0]).toMatchObject({
      from: 'Q',
      to: 'P',
      fromCard: 'ZERO_OR_MORE',
      toCard: 'ONLY_ONE',
    });
    const plain = reverseRel(await shop(), 'R_CUSTOMER_ORDER_0');
    expect(plain.model.rels[0]).toMatchObject({ fromCard: 'ZERO_OR_MORE', toCard: 'ONLY_ONE' });
    expect(reverseRel(model, 'missing').id).toBe('missing');
  });
});

describe('subgraphs', () => {
  it('ungroups into the parent subgraph and drops links to the subgraph', async () => {
    const model = await read(`${ER_FIXTURES.subgraphs!}    CUSTOMER ||--o{ Billing : group\n`);
    const next = ungroup(model, 'Billing');
    expect(next.subgraphs).toEqual([
      {
        id: 'Sales',
        title: 'Sales area',
        members: ['ORDER', 'INVOICE'],
        dir: 'TB',
        classes: ['hot', 'cold'],
      },
    ]);
    expect(next.rels.map((rel) => rel.to)).toEqual(['ORDER', 'INVOICE']);
    expect(ungroup(model, 'Sales').subgraphs).toHaveLength(1);
    expect(ungroup(model, 'nope')).toBe(model);
  });

  it('patches a subgraph', async () => {
    expect(updateGroup(await shop(), 'Sales', { dir: 'LR' }).subgraphs[1]!.dir).toBe('LR');
  });
});

describe('deleteItems', () => {
  it('deletes entities with their relationships, relationships and subgraphs', async () => {
    const model = await shop();
    const next = deleteItems(model, {
      entityNames: ['ORDER'],
      groupIds: ['Billing'],
      relIds: ['R_CUSTOMER_CUSTOMER_0'],
    });
    expect(next.entities.map((item) => item.name)).toEqual(['INVOICE', 'CUSTOMER']);
    expect(next.rels).toEqual([]);
    expect(next.subgraphs).toEqual([
      {
        id: 'Sales',
        title: 'Sales area',
        members: ['INVOICE'],
        dir: 'TB',
        classes: ['hot', 'cold'],
      },
    ]);
    expect(deleteItems(model, {})).toEqual(model);
  });
});

describe('attributes', () => {
  it('suggests an id first, then numbered fields', () => {
    const blank: ErEntity = { name: 'A', alias: '', attributes: [], classes: [] };
    expect(newAttribute(blank)).toEqual({ type: 'int', name: 'id', keys: ['PK'], comment: '' });
    const withField: ErEntity = {
      ...blank,
      attributes: [newAttribute(blank), { type: 'string', name: 'field', keys: [], comment: '' }],
    };
    expect(newAttribute(withField)).toEqual({
      type: 'string',
      name: 'field2',
      keys: [],
      comment: '',
    });
  });

  it('adds, updates, toggles, removes and moves attributes', async () => {
    const model = addAttribute(addAttribute(await shop(), 'ORDER'), 'ORDER');
    expect(entity(model, 'ORDER').attributes.map((attribute) => attribute.name)).toEqual([
      'id',
      'field',
    ]);
    const ref = { entityName: 'ORDER', index: 1 };
    const patch = { type: 'var char', name: '1st', comment: 'a\nb', keys: ['UK', 'PK'] as const };
    expect(
      entity(
        updateAttribute(model, { ...ref, patch: { ...patch, keys: [...patch.keys] } }),
        'ORDER',
      ).attributes[1],
    ).toEqual({
      type: 'var_char',
      name: '_1st',
      keys: ['PK', 'UK'],
      comment: 'a b',
    });
    expect(entity(toggleKey(model, { ...ref, key: 'FK' }), 'ORDER').attributes[1]!.keys).toEqual([
      'FK',
    ]);
    expect(
      entity(toggleKey(model, { entityName: 'ORDER', index: 0, key: 'PK' }), 'ORDER').attributes[0]!
        .keys,
    ).toEqual([]);
    expect(toggleKey(model, { entityName: 'ORDER', index: 5, key: 'PK' })).toBe(model);
    expect(toggleKey(model, { entityName: 'NOPE', index: 0, key: 'PK' })).toBe(model);
    expect(
      entity(removeAttribute(model, 'ORDER', 0), 'ORDER').attributes.map(
        (attribute) => attribute.name,
      ),
    ).toEqual(['field']);
    expect(entity(moveAttribute(model, { ...ref, delta: -1 }), 'ORDER').attributes[0]!.name).toBe(
      'field',
    );
    expect(entity(moveAttribute(model, { ...ref, delta: 1 }), 'ORDER')).toEqual(
      entity(model, 'ORDER'),
    );
  });
});
