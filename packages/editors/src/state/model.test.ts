import { describe, expect, it } from 'vitest';

import {
  assignNoteIds,
  emptyModel,
  parse,
  serialize,
  stateEditor,
  transitionScope,
} from './model.ts';
import { splitRegions } from './parse.ts';
import { STATE_FIXTURES } from '../../tests/fixtures/state.ts';
import { loadMermaid } from '../../tests/mermaid-loader.ts';
import { fakeLoader, parseOk } from '../../tests/parse-ok.ts';

import type { StateModel, StateNode } from './types.ts';

/** Statement order is not meaningful: compare states, transitions and notes as sorted sets. */
function normalized(model: StateModel): object {
  const byJson = (a: object, b: object): number =>
    JSON.stringify(a).localeCompare(JSON.stringify(b));
  return {
    ...model,
    states: [...model.states].sort(byJson),
    transitions: model.transitions.map(({ from, to, label }) => ({ from, to, label })).sort(byJson),
    notes: [...model.notes].sort(byJson),
  };
}

const read = async (code: string): Promise<StateModel> => parseOk(parse, code);
const state = (id: string, patch: Partial<StateNode> = {}): StateNode => ({
  id,
  type: 'state',
  isComposite: false,
  regions: 0,
  name: '',
  desc: [],
  parent: null,
  classes: [],
  dir: '',
  ...patch,
});

describe('state diagram round trip', () => {
  it.each(Object.entries(STATE_FIXTURES))(
    '%s is stable and keeps its meaning',
    async (name, code) => {
      const first = await read(code);
      const written = serialize(first);
      const second = await read(written);
      expect(normalized(second), name).toEqual(normalized(first));
      expect(serialize(second)).toBe(written);
    },
  );
});

describe('parse', () => {
  it('reads the template', async () => {
    const model = await read(STATE_FIXTURES.template!);
    expect(model.states.map((item) => [item.id, item.parent, item.isComposite])).toEqual([
      ['Draft', null, false],
      ['Review', null, false],
      ['Published', null, true],
      ['Live', 'Published', false],
      ['Archived', 'Published', false],
    ]);
    expect(model.transitions.map((item) => [item.from, item.to, item.label])).toEqual([
      ['start:', 'Draft', ''],
      ['Draft', 'Review', 'submit'],
      ['Review', 'Draft', 'changes requested'],
      ['Review', 'Published', 'approve'],
      ['start:Published', 'Live', ''],
      ['Live', 'Archived', 'expire'],
      ['Published', 'end:', ''],
    ]);
  });

  it('reads names, descriptions and pseudo state types', async () => {
    const model = await read(STATE_FIXTURES.descriptions!);
    expect(model.states.map((item) => [item.id, item.name, item.desc])).toEqual([
      ['Waiting', 'Waiting for input', []],
      ['Idle', 'The idle state', ['second line']],
      ['Same', 'Same', ['with a description']],
      ['Plain', '', []],
    ]);
    const pseudo = await read(STATE_FIXTURES.pseudoStates!);
    expect(pseudo.states.slice(0, 3).map((item) => item.type)).toEqual(['fork', 'join', 'choice']);
  });

  it('reads concurrent regions and nested directions', async () => {
    const regions = await read(STATE_FIXTURES.regions!);
    expect(regions.states[0]).toMatchObject({ id: 'Active', regions: 2 });
    expect(regions.states.map((item) => item.parent)).toEqual([
      null,
      'Active#0',
      'Active#0',
      'Active#1',
      'Active#1',
    ]);
    const nested = await read(STATE_FIXTURES.nested!);
    expect(nested.direction).toBe('TB');
    expect(nested.states.find((item) => item.id === 'Outer')!.dir).toBe('LR');
  });

  it('reads notes, classes, styles and kept lines', async () => {
    const notes = await read(STATE_FIXTURES.notes!);
    expect(notes.notes).toEqual([
      {
        id: 'note:State1:0',
        target: 'State1',
        side: 'right',
        text: 'Important information!\nYou can write\nnotes.',
      },
      {
        id: 'note:State2:0',
        target: 'State2',
        side: 'left',
        text: 'This is the note to the left.',
      },
    ]);
    const styled = await read(STATE_FIXTURES.styling!);
    expect(styled.states.map((item) => [item.id, item.classes])).toEqual([
      ['Still', []],
      ['Moving', ['movement']],
      ['Crash', ['badBadEvent']],
    ]);
    expect(styled.styles).toEqual([{ ids: ['Still'], css: 'fill:#0f0' }]);
    expect(styled.extra).toEqual([
      'classDef badBadEvent fill:#f00,color:white',
      'classDef movement font-style:italic',
      'click Still href "https://example.com"',
      'accTitle: Title',
      'accDescr {\nLong\ndescription\n}',
    ]);
  });

  it('keeps the v1 header and reads empty code as an empty model', async () => {
    expect((await read(STATE_FIXTURES.v1Header!)).header).toBe('stateDiagram');
    expect(await parse('', loadMermaid)).toEqual({ kind: 'ok', model: emptyModel() });
  });

  it('reports other types, invalid code and a wrong db', async () => {
    expect(await parse('erDiagram\n  A ||--o{ B : x', loadMermaid)).toEqual({
      kind: 'unsupported',
      message: 'er',
    });
    expect((await parse('stateDiagram-v2\n  A --> ', loadMermaid)).kind).toBe('error');
    expect(
      (await parse('stateDiagram-v2\n  A', fakeLoader('stateDiagram', { rootDoc: 'no' }))).kind,
    ).toBe('error');
    expect((await parse('stateDiagram-v2\n  A', fakeLoader('stateDiagram', null))).kind).toBe(
      'error',
    );
  });

  it('reads an untranslated tree through getRootDocV2, and tolerates odd statements', async () => {
    const translated = [
      {
        stmt: 'relation',
        state1: { stmt: 'state', id: 'x', start: true },
        state2: { stmt: 'state', id: 'A' },
      },
    ];
    const db = {
      rootDoc: [{ stmt: 'relation', state1: { id: '[*]' }, state2: { id: 'A' } }],
      getRootDocV2: (): object => ({ doc: translated }),
    };
    const result = await parse('stateDiagram-v2\n  x', fakeLoader('stateDiagram', db));
    expect(result.kind === 'ok' && result.model.transitions).toEqual([
      { id: 't0', from: 'start:', to: 'A', label: '' },
    ]);
    const odd = {
      getRootDocV2: (): object => ({}),
      rootDoc: [
        { stmt: 'relation', state1: { id: 'A' } },
        { stmt: 'unknown' },
        { stmt: 'dir', value: 'LR' },
        { stmt: 'state', id: 'B', description: ['one', 'two'], type: 'mystery' },
        { stmt: 'applyClass', id: 'B', styleClass: ' hot ' },
        { stmt: 'style', id: 'B', styleClass: 'fill:red' },
        { stmt: 'default', id: 'C' },
        { stmt: 'state', id: 'D', type: 'divider' },
      ],
    };
    const parsed = await parse('stateDiagram-v2\n  x', fakeLoader('stateDiagram', odd));
    expect(
      parsed.kind === 'ok' &&
        parsed.model.states.map((item) => [item.id, item.type, item.name, item.classes]),
    ).toEqual([
      ['A', 'state', '', []],
      ['B', 'state', 'one,two', ['hot']],
      ['C', 'state', '', []],
    ]);
    const empty = await parse(
      'stateDiagram-v2\n  x',
      fakeLoader('stateDiagram', { getRootDocV2: (): object => ({}) }),
    );
    expect(empty.kind === 'ok' && empty.model.states).toEqual([]);
  });

  it('rejects an unknown direction', async () => {
    const db = { rootDoc: [{ stmt: 'dir', value: 'XY' }] };
    expect(await parse('stateDiagram-v2\n  x', fakeLoader('stateDiagram', db))).toEqual({
      kind: 'error',
      message: 'Unknown state diagram direction "XY"',
    });
    const none = { rootDoc: [{ stmt: 'dir' }] };
    expect(await parse('stateDiagram-v2\n  x', fakeLoader('stateDiagram', none))).toEqual({
      kind: 'error',
      message: 'Unknown state diagram direction ""',
    });
  });
});

describe('splitRegions', () => {
  it('reads raw divider markers between statements', () => {
    const a = { stmt: 'state', id: 'A' };
    const b = { stmt: 'state', id: 'B' };
    expect(splitRegions([a, { type: 'divider' }, b])).toEqual([[a], [b]]);
    expect(splitRegions([a, { type: 'divider', doc: [b] }])).toBeNull();
    expect(
      splitRegions([
        { type: 'divider', doc: [a] },
        { type: 'divider', doc: [b] },
      ]),
    ).toEqual([[a], [b]]);
    expect(splitRegions([a, b])).toBeNull();
  });
});

describe('serialize', () => {
  it('writes the template with composites before the transitions of their scope', async () => {
    expect(serialize(await read(STATE_FIXTURES.template!))).toBe(`stateDiagram-v2
    state Published {
        [*] --> Live
        Live --> Archived : expire
    }
    [*] --> Draft
    Draft --> Review : submit
    Review --> Draft : changes requested
    Review --> Published : approve
    Published --> [*]
`);
  });

  it('declares names, descriptions, pseudo types and lone states', () => {
    const model: StateModel = {
      ...emptyModel(),
      states: [
        state('A', { name: 'Long "name"' }),
        state('B', { desc: ['x\ny'] }),
        state('C', { name: 'C', desc: ['d'] }),
        state('D', { type: 'choice' }),
        state('E'),
        state('Box', { isComposite: true, name: 'The box', dir: 'LR' }),
      ],
      notes: [
        { id: 'n', target: 'E', side: 'left', text: '' },
        { id: 'm', target: 'E', side: 'right', text: 'a\n\n b\n' },
      ],
      styles: [{ ids: [], css: 'x' }],
    };
    expect(serialize(model)).toBe(`stateDiagram-v2
    state "Long #quot;name#quot;" as A
    state "B" as B
    B : x y
    state "C" as C
    C : d
    state D <<choice>>
    E
    state "The box" as Box {
        direction LR
    }
    note left of E :  
    note right of E
        a
${'        '}
        b
    end note
`);
  });
});

describe('helpers', () => {
  it('numbers notes per target', () => {
    const model = assignNoteIds({
      ...emptyModel(),
      notes: [
        { id: '', target: 'A', side: 'left', text: '' },
        { id: '', target: 'A', side: 'left', text: '' },
        { id: '', target: 'B', side: 'left', text: '' },
      ],
    });
    expect(model.notes.map((note) => note.id)).toEqual(['note:A:0', 'note:A:1', 'note:B:0']);
  });

  it('finds the scope a transition is written in', () => {
    const model: StateModel = {
      ...emptyModel(),
      states: [state('A', { parent: 'X' }), state('B', { parent: 'X' }), state('C')],
    };
    expect(transitionScope(model, { id: 't', from: 'A', to: 'B', label: '' })).toBe('X');
    expect(transitionScope(model, { id: 't', from: 'A', to: 'C', label: '' })).toBeNull();
    expect(transitionScope(model, { id: 't', from: 'start:X', to: 'A', label: '' })).toBe('X');
  });

  it('bundles the model functions', () => {
    expect(stateEditor).toEqual({ id: 'state', emptyModel, parse, serialize });
  });
});
