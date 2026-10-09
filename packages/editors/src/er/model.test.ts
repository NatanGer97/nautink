import { describe, expect, it } from 'vitest';

import {
  cleanName,
  cleanText,
  cleanWord,
  displayName,
  emptyModel,
  erEditor,
  nameSource,
  parse,
  relId,
  relSource,
  serialize,
  uniqueName,
} from './model.ts';
import { ER_FIXTURES } from '../../tests/fixtures/er.ts';
import { loadMermaid } from '../../tests/mermaid-loader.ts';
import { fakeLoader, parseOk } from '../../tests/parse-ok.ts';

import type { ErModel, ErRelationship } from './model.ts';

/** Entity order is not meaningful: Mermaid reads entities back in first-mention order. */
function normalized(model: ErModel): ErModel {
  return { ...model, entities: [...model.entities].sort((a, b) => a.name.localeCompare(b.name)) };
}

const read = async (code: string): Promise<ErModel> => parseOk(parse, code);

describe('ER round trip', () => {
  it.each(Object.entries(ER_FIXTURES))('%s is stable and keeps its meaning', async (name, code) => {
    const first = await read(code);
    const written = serialize(first);
    const second = await read(written);
    expect(normalized(second), name).toEqual(normalized(first));
    expect(serialize(second)).toBe(written);
  });
});

describe('parse', () => {
  it('reads the template', async () => {
    const model = await read(ER_FIXTURES.template!);
    expect(model.entities.map((entity) => entity.name)).toEqual([
      'CUSTOMER',
      'ORDER',
      'ORDER_ITEM',
      'PRODUCT',
    ]);
    expect(model.entities[2]!.attributes[0]).toEqual({
      type: 'int',
      name: 'order_id',
      keys: ['PK', 'FK'],
      comment: '',
    });
    expect(model.rels[2]).toEqual({
      id: 'R_PRODUCT_ORDER_ITEM_0',
      from: 'PRODUCT',
      to: 'ORDER_ITEM',
      fromCard: 'ONLY_ONE',
      toCard: 'ZERO_OR_MORE',
      isIdentifying: true,
      label: 'ordered in',
    });
  });

  it('reads every cardinality and numbers parallel relationships', async () => {
    const model = await read(ER_FIXTURES.cardinalities!);
    expect(model.direction).toBe('LR');
    expect(model.rels.map((rel) => [rel.id, rel.fromCard, rel.toCard, rel.isIdentifying])).toEqual([
      ['R_A_B_0', 'ZERO_OR_ONE', 'ZERO_OR_ONE', true],
      ['R_C_A_0', 'ZERO_OR_MORE', 'ONE_OR_MORE', false],
      ['R_A_D_0', 'ONLY_ONE', 'ONLY_ONE', true],
      ['R_P_Q_0', 'MD_PARENT', 'ZERO_OR_MORE', true],
      ['R_A_B_1', 'ONLY_ONE', 'ZERO_OR_MORE', true],
    ]);
  });

  it('reads subgraphs, their classes and links to them', async () => {
    const model = await read(ER_FIXTURES.subgraphs!);
    expect(model.subgraphs).toEqual([
      { id: 'Billing', title: '', members: ['INVOICE'], dir: '', classes: [] },
      {
        id: 'Sales',
        title: 'Sales area',
        members: ['ORDER', 'Billing'],
        dir: 'TB',
        classes: ['hot', 'cold'],
      },
    ]);
  });

  it('keeps style lines outside attribute blocks and accDescr blocks', async () => {
    expect((await read(ER_FIXTURES.styling!)).extra).toEqual([
      'classDef hot fill:#f00',
      'style A fill:#0f0',
      'accTitle: Title',
      'accDescr: Short description',
    ]);
    expect((await read(ER_FIXTURES.entities!)).extra).toEqual([]);
    expect((await read(ER_FIXTURES.accDescrBlock!)).accDescr).toBe('Long\ndescription');
  });

  it('returns an empty model for empty code and reports errors', async () => {
    expect(await parse(' ', loadMermaid)).toEqual({ kind: 'ok', model: emptyModel() });
    expect(await parse('flowchart TD\n  a', loadMermaid)).toEqual({
      kind: 'unsupported',
      message: 'flowchart-v2',
    });
    expect((await parse('erDiagram\n  A ||--', loadMermaid)).kind).toBe('error');
  });

  it('fills in every field Mermaid leaves out', async () => {
    const db = {
      getEntities: (): Map<string, object> =>
        new Map([['A', { id: 'e1', attributes: [{ type: 't', name: 'n', keys: ['pk', 'x'] }] }]]),
      getRelationships: (): object[] => [
        {
          entityA: 'e1',
          entityB: 'zz',
          relSpec: { cardA: 'WEIRD', cardB: 'ONLY_ONE', relType: 'IDENTIFYING' },
        },
      ],
      getSubGraphs: (): object[] => [{ id: 'S', nodes: [] }],
    };
    expect(await parse('erDiagram\n  x', fakeLoader('er', db))).toEqual({
      kind: 'ok',
      model: {
        ...emptyModel(),
        entities: [
          {
            name: 'A',
            alias: '',
            attributes: [{ type: 't', name: 'n', keys: ['PK'], comment: '' }],
            classes: [],
          },
        ],
        rels: [
          {
            id: 'R_A_zz_0',
            from: 'A',
            to: 'zz',
            fromCard: 'ONLY_ONE',
            toCard: 'ONLY_ONE',
            isIdentifying: true,
            label: '',
          },
        ],
        subgraphs: [{ id: 'S', title: '', members: [], dir: '', classes: [] }],
      },
    });
  });

  it('rejects an unknown direction', async () => {
    const db = {
      getEntities: (): Map<string, object> => new Map(),
      getRelationships: (): object[] => [],
      getSubGraphs: (): object[] => [],
      getDirection: (): string => 'XY',
    };
    expect(await parse('erDiagram\n  x', fakeLoader('er', db))).toEqual({
      kind: 'error',
      message: 'Unknown ER diagram direction "XY"',
    });
  });

  it('reads an accDescr block Mermaid did not keep as empty', async () => {
    const db = {
      getEntities: (): Map<string, object> => new Map(),
      getRelationships: (): object[] => [],
      getSubGraphs: (): object[] => [],
    };
    const result = await parse('erDiagram\n  accDescr {\n x\n }', fakeLoader('er', db));
    expect(result.kind === 'ok' && result.model.accDescr).toBe('');
  });
});

describe('serialize', () => {
  it('writes the template in normalized order', async () => {
    expect(serialize(await read(ER_FIXTURES.template!))).toBe(ER_FIXTURES.template);
  });

  it('declares linked entities after the relationships, in first-mention order', async () => {
    expect(
      serialize(await read('erDiagram\n    B { int x }\n    LONE\n    A ||--o{ B : has\n')),
    ).toBe('erDiagram\n    A ||--o{ B : has\n    B {\n        int x\n    }\n    LONE\n');
  });
});

describe('source helpers', () => {
  it('cleans names, text and attribute words', () => {
    expect(cleanName(' a"b%c\\d\n ')).toBe('abcd');
    expect(cleanText('a\r\nb')).toBe('a b');
    expect(cleanWord(' var char ', 'string')).toBe('var_char');
    expect(cleanWord('List~int x~', 'string')).toBe('List~int_x~');
    expect(cleanWord('int?', 'string')).toBe('int?');
    expect(cleanWord('9lives', 'field')).toBe('_9lives');
    expect(cleanWord('pk', 'field')).toBe('_pk');
    expect(cleanWord('PK_id', 'field')).toBe('PK_id');
    expect(cleanWord('?', 'field')).toBe('field');
    expect(cleanWord('%%', 'field')).toBe('field');
  });

  it('quotes names the lexer would not read as one word', () => {
    expect(nameSource('ORDER_ITEM')).toBe('ORDER_ITEM');
    expect(nameSource('a-b')).toBe('a-b');
    expect(nameSource('one-two')).toBe('"one-two"');
    expect(nameSource('Big Entity')).toBe('"Big Entity"');
  });

  it('writes relationships with quoted labels when needed', () => {
    const rel: ErRelationship = {
      id: 'r',
      from: 'A',
      to: 'B',
      fromCard: 'MD_PARENT',
      toCard: 'MD_PARENT',
      isIdentifying: false,
      label: 'many',
    };
    expect(relSource(rel)).toBe('A u..|| B : "many"');
    expect(relSource({ ...rel, label: 'say "hi"' })).toBe('A u..|| B : "say #quot;hi#quot;"');
    expect(relSource({ ...rel, label: 'has' })).toBe('A u..|| B : has');
  });

  it('builds ids and names', () => {
    expect(relId('A', 'B', 2)).toBe('R_A_B_2');
    const model: ErModel = {
      ...emptyModel(),
      entities: [{ name: 'ENTITY', alias: 'Shown', attributes: [], classes: [] }],
      subgraphs: [{ id: 'ENTITY_2', title: '', members: [], dir: '', classes: [] }],
    };
    expect(uniqueName(model)).toBe('ENTITY_3');
    expect(uniqueName(model, 'OTHER')).toBe('OTHER');
    expect(displayName(model.entities[0]!)).toBe('Shown');
    expect(displayName({ ...model.entities[0]!, alias: '' })).toBe('ENTITY');
  });

  it('bundles the model functions', () => {
    expect(erEditor).toEqual({ id: 'er', emptyModel, parse, serialize });
  });
});
