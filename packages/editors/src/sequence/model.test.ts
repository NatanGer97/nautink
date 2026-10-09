import { describe, expect, it } from 'vitest';

import {
  arrowToken,
  declSource,
  emptyModel,
  findItem,
  listKey,
  msgSource,
  newId,
  noteSource,
  parse,
  sequenceEditor,
  serialize,
  serializeWith,
  uniqueParticipantId,
  walkItems,
} from './model.ts';
import { lineTypes } from './parse.ts';
import { SEQUENCE_FIXTURES } from '../../tests/fixtures/sequence.ts';
import { loadMermaid } from '../../tests/mermaid-loader.ts';
import { fakeLoader, parseOk } from '../../tests/parse-ok.ts';

import type { ItemVisit } from './model.ts';
import type { MessageItem, Participant, SequenceModel } from './types.ts';

const read = async (code: string): Promise<SequenceModel> => parseOk(parse, code);
const participant = (id: string, patch: Partial<Participant> = {}): Participant => ({
  id,
  label: id,
  kind: 'participant',
  box: null,
  isCreated: false,
  ...patch,
});
const message = (patch: Partial<MessageItem> = {}): MessageItem => ({
  t: 'msg',
  id: 'm',
  from: 'A',
  to: 'B',
  text: 'hi',
  line: 'solid',
  head: 'arrow',
  act: '',
  central: '',
  create: [],
  destroy: [],
  ...patch,
});

describe('sequence round trip', () => {
  it.each(Object.entries(SEQUENCE_FIXTURES))(
    '%s is stable and keeps its meaning',
    async (name, code) => {
      const first = await read(code);
      const written = serialize(first);
      const second = await read(written);
      expect(second, name).toEqual(first);
      expect(serialize(second)).toBe(written);
    },
  );
});

describe('parse', () => {
  it('reads the template', async () => {
    const model = await read(SEQUENCE_FIXTURES.template!);
    expect(model.participants.map((item) => [item.id, item.label, item.kind])).toEqual([
      ['U', 'User', 'actor'],
      ['W', 'Web app', 'participant'],
      ['A', 'API', 'participant'],
      ['D', 'Database', 'database'],
    ]);
    expect(model.items.map((item) => item.t)).toEqual(['msg', 'msg', 'msg', 'block', 'act', 'msg']);
    expect(model.items[1]).toMatchObject({ from: 'W', to: 'A', act: '+', text: 'POST /login' });
    const block = model.items[3];
    expect(
      block?.t === 'block' &&
        block.sections.map((section) => [section.label, section.items.length]),
    ).toEqual([
      ['valid password', 2],
      ['wrong password', 1],
    ]);
  });

  it('reads notes, activations, lifecycle and autonumber', async () => {
    const notes = await read(SEQUENCE_FIXTURES.notes!);
    expect(notes.items.map((item) => item.t === 'note' && [item.placement, item.actors])).toEqual([
      ['left', ['A']],
      ['right', ['B']],
      ['over', ['A']],
      ['over', ['A', 'B']],
      ['over', ['A']],
    ]);
    const lifecycle = await read(SEQUENCE_FIXTURES.lifecycle!);
    expect(lifecycle.participants.map((item) => [item.id, item.isCreated])).toEqual([
      ['A', false],
      ['B', false],
      ['C', true],
      ['D', true],
    ]);
    expect(lifecycle.items[1]).toMatchObject({ create: ['C'] });
    expect(lifecycle.items[3]).toMatchObject({ destroy: ['C'] });
    const numbered = await read(SEQUENCE_FIXTURES.autonumber!);
    expect(numbered.autonumber).toEqual({ start: 10, step: 5, isVisible: true });
    expect(numbered.items.filter((item) => item.t === 'autonumber')).toEqual([
      { t: 'autonumber', id: 'i1', isVisible: false },
      { t: 'autonumber', id: 'i3', start: 3, step: 1, isVisible: true },
      { t: 'autonumber', id: 'i5', isVisible: true },
    ]);
  });

  it('keeps head and trailing lines and wrap overrides', async () => {
    const text = await read(SEQUENCE_FIXTURES.text!);
    expect(text.head).toEqual([
      'title Login flow',
      'accTitle: Accessible title',
      'accDescr {\nLong\ndescription\n}',
    ]);
    expect(text.extra).toEqual([
      'link A: Dashboard @ https://example.com',
      'links B: {"Repo": "https://example.com"}',
    ]);
    const wrapping = await read(SEQUENCE_FIXTURES.wrapping!);
    expect(
      wrapping.items.map((item) =>
        item.t === 'msg' || item.t === 'note' ? item.shouldWrap : null,
      ),
    ).toEqual([true, undefined, true]);
  });

  it('reports invalid code, other types and a wrong db', async () => {
    expect((await parse('', loadMermaid)).kind).toBe('error');
    expect(await parse('erDiagram\n  A ||--o{ B : x', loadMermaid)).toEqual({
      kind: 'unsupported',
      message: 'er',
    });
    expect((await parse('sequenceDiagram\n  A', fakeLoader('sequence', {}))).kind).toBe('error');
  });

  it('reads a minimal db, filling in what Mermaid leaves out', async () => {
    const box = { name: 'Group' };
    const db = {
      LINETYPE: { AUTONUMBER: 26, NOTE: 2, ACTIVE_START: 17, ACTIVE_END: 18 },
      autoWrap: (): boolean => false,
      getBoxes: (): object[] => [box, {}],
      getActors: (): Map<string, object> =>
        new Map([
          ['A', { box, type: 'odd' }],
          ['B', {}],
        ]),
      getCreatedActors: (): Map<string, number> => new Map(),
      getDestroyedActors: (): Map<string, number> => new Map(),
      getMessages: (): object[] => [
        { type: 26, message: { visible: false } },
        { type: 2, from: 'A', to: 'A', message: 'n', placement: 9 },
        { type: 20 },
        { type: 11 },
        { type: 0, from: 'A', to: 'B', message: 'x', activate: true },
        { type: 17, from: 'B' },
        { type: 0, from: 'A', to: 'B' },
        { type: 60, from: 'A' },
        { type: 17, from: 'A' },
        { type: 99 },
      ],
    };
    const result = await parse('sequenceDiagram\n  A->>B: x', fakeLoader('sequence', db));
    expect(result.kind === 'ok' && result.model).toMatchObject({
      autonumber: { isVisible: false },
      participants: [
        { id: 'A', label: 'A', kind: 'participant', box: 'box1', isCreated: false },
        { id: 'B', label: 'B', kind: 'participant', box: null, isCreated: false },
      ],
      boxes: [{ id: 'box1', name: 'Group', fill: 'transparent' }],
      items: [
        { t: 'note', placement: 'over', actors: ['A'], text: 'n' },
        { t: 'msg', act: '+', text: 'x' },
        { t: 'msg', act: '', text: '' },
        { t: 'act', actor: 'A', isOn: true },
      ],
    });
  });

  it('needs the LINETYPE codes', () => {
    expect(() => lineTypes({})).toThrow("Mermaid's sequence db has no LINETYPE.AUTONUMBER");
    expect(() => lineTypes({ LINETYPE: { AUTONUMBER: 1 } })).toThrow('LINETYPE.NOTE');
  });
});

describe('serialize', () => {
  it('writes the template in normalized order', async () => {
    expect(serialize(await read(SEQUENCE_FIXTURES.template!))).toBe(SEQUENCE_FIXTURES.template);
  });

  it('declares only the participants it must, boxes included', () => {
    const model: SequenceModel = {
      ...emptyModel(),
      participants: [participant('B'), participant('A', { box: 'box1' }), participant('C')],
      boxes: [{ id: 'box1', name: 'Purple team', fill: 'transparent' }],
      items: [message({ from: 'A', to: 'B' }), message({ from: 'B', to: 'C' })],
    };
    expect(serialize(model)).toBe(`sequenceDiagram
    participant B
    box transparent Purple team
        participant A
    end
    A->>B: hi
    B->>C: hi
`);
    expect(serializeWith(model, { isColor: () => false })).toContain('    box Purple team\n');
  });

  it('declares every participant when no shorter list keeps the order', () => {
    const model: SequenceModel = {
      ...emptyModel(),
      participants: [participant('A'), participant('C', { isCreated: true }), participant('B')],
      items: [message({ from: 'A', to: 'B' })],
    };
    expect(serialize(model)).toBe(
      'sequenceDiagram\n    participant A\n    participant B\n    A->>B: hi\n',
    );
  });

  it('writes every arrow head', () => {
    const heads = [
      'arrow',
      'open',
      'cross',
      'async',
      'bi',
      'halfTop',
      'halfBottom',
      'stickTop',
      'stickBottom',
      'halfTopRev',
      'halfBottomRev',
      'stickTopRev',
      'stickBottomRev',
    ] as const;
    expect(heads.map((head) => arrowToken({ head, line: 'solid' }))).toEqual([
      '->>',
      '->',
      '-x',
      '-)',
      '<<->>',
      '-|\\',
      '-|/',
      '-\\\\',
      '-//',
      '/|-',
      '\\|-',
      '//-',
      '\\\\-',
    ]);
  });

  it('writes box headers for every fill and name', () => {
    const base: SequenceModel = { ...emptyModel(), participants: [participant('A', { box: 'b' })] };
    const header = (fill: string, name: string): string =>
      serialize({ ...base, boxes: [{ id: 'b', name, fill }] })
        .split('\n')[1]!
        .trim();
    expect(header('red', 'Team')).toBe('box red Team');
    expect(header('red', '')).toBe('box red');
    expect(header('', '')).toBe('box');
    expect(header('transparent', 'rgb(1,2,3) x')).toBe('box transparent rgb(1,2,3) x');
  });
});

describe('sources', () => {
  it('writes participant declarations', () => {
    expect(declSource(participant('A'))).toBe('participant A');
    expect(declSource(participant('A', { kind: 'actor', label: 'Alice' }))).toBe(
      'actor A as Alice',
    );
    expect(declSource(participant('Q', { kind: 'queue', label: '' }))).toBe(
      'participant Q@{ "type": "queue" }',
    );
  });

  it('writes messages with heads, centrals, activations and wrap', () => {
    expect(arrowToken({ head: 'bi', line: 'dotted' })).toBe('<<-->>');
    expect(msgSource(message({ act: '+', text: 'a;b' }))).toBe('A->>+B: a#59;b');
    expect(msgSource(message({ central: 'both', act: '+' }))).toBe('A()->>()B: hi');
    expect(msgSource(message({ text: '', shouldWrap: false }))).toBe('A->>B: nowrap:');
    expect(msgSource(message({ text: '' }))).toBe('A->>B:');
  });

  it('writes notes', () => {
    expect(
      noteSource({
        t: 'note',
        id: 'n',
        placement: 'right',
        actors: ['A'],
        text: 'x\ny',
        shouldWrap: true,
      }),
    ).toBe('Note right of A: wrap:x<br>y');
  });
});

describe('tree helpers', () => {
  it('walks, finds and keys items', async () => {
    const model = await read(SEQUENCE_FIXTURES.blocks!);
    const seen: string[] = [];
    walkItems(model.items, ({ item, depth }: ItemVisit) => seen.push(`${item.t}${String(depth)}`));
    expect(seen.slice(0, 5)).toEqual(['msg0', 'block0', 'msg1', 'block1', 'msg2']);
    const found = findItem(model, 'i4')!;
    expect(found.parent?.id).toBe('i3');
    expect(listKey(found.parent, found.sectionIndex)).toBe('i3:0');
    expect(listKey(null, 0)).toBe('root');
    expect(findItem(model, 'nope')).toBeNull();
  });

  it('finds free participant ids and fresh item ids', () => {
    const model: SequenceModel = {
      ...emptyModel(),
      participants: [participant('P1'), participant('Actor')],
    };
    expect(uniqueParticipantId(model)).toBe('P2');
    expect(uniqueParticipantId(model, 'Queue')).toBe('Queue');
    expect(uniqueParticipantId(model, 'Actor')).toBe('Actor1');
    expect(newId()).not.toBe(newId());
  });

  it('bundles the model functions', () => {
    expect(sequenceEditor).toEqual({ id: 'sequence', emptyModel, parse, serialize });
  });
});
