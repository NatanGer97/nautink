import { describe, expect, it } from 'vitest';

import {
  classEditor,
  emptyModel,
  isAbstract,
  kindOf,
  noteIdFor,
  parse,
  relationId,
  relationSource,
  serialize,
  uniqueClassId,
  uniqueNsId,
} from './model.ts';
import { CLASS_FIXTURES } from '../../tests/fixtures/class.ts';
import { loadMermaid } from '../../tests/mermaid-loader.ts';
import { fakeLoader, parseOk } from '../../tests/parse-ok.ts';

import type { ClassModel, ClassRelation } from './types.ts';

const read = async (code: string): Promise<ClassModel> => parseOk(parse, code);

describe('class diagram round trip', () => {
  it.each(Object.entries(CLASS_FIXTURES))(
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
    const model = await read(CLASS_FIXTURES.template!);
    expect(model.classes.map((item) => item.id)).toEqual(['Animal', 'Dog', 'Cat', 'Owner']);
    expect(model.classes[0]).toEqual({
      id: 'Animal',
      label: '',
      generic: '',
      annotations: ['abstract'],
      attrs: [
        { vis: '+', text: 'String name', cls: '' },
        { vis: '+', text: 'int age', cls: '' },
      ],
      methods: [{ vis: '+', name: 'makeSound', params: '', ret: 'void', cls: '*' }],
      css: [],
      ns: '',
    });
    expect(model.relations[2]).toEqual({
      id: 'R:Owner:Animal:0',
      from: 'Owner',
      to: 'Animal',
      t1: 'agg',
      t2: 'none',
      line: 'solid',
      label: 'owns',
      m1: '1',
      m2: '0..*',
    });
  });

  it('reads a bare header as an empty diagram', async () => {
    expect(await read('classDiagram\n')).toEqual(emptyModel());
    expect(await read('%% hi\nclassDiagram-v2\n  direction LR\n')).toEqual({
      ...emptyModel(),
      header: 'classDiagram-v2',
      direction: 'LR',
      isDirExplicit: true,
    });
    expect(await parse('', loadMermaid)).toEqual({ kind: 'ok', model: emptyModel() });
  });

  it('reads lollipop ends as their interface label', async () => {
    const model = await read(CLASS_FIXTURES.lollipops!);
    expect(
      model.relations.map((relation) => [relation.from, relation.t1, relation.to, relation.t2]),
    ).toEqual([
      ['Bar', 'lolli', 'Foo', 'none'],
      ['Baz', 'none', 'Qux', 'lolli'],
    ]);
  });

  it('keeps style lines and multi-line accDescr blocks, drops comments', async () => {
    const model = await read(CLASS_FIXTURES.styling!);
    expect(model.extra).toEqual([
      'cssClass "A,B" cool',
      'classDef hot fill:#f00',
      'classDef cool stroke:#00f',
      'style B fill:#0f0',
      'click A href "https://example.com"',
      'link B "https://example.com"',
      'callback A "cb"',
      'accTitle: Title',
      'accDescr {\nLong\ndescription\n}',
    ]);
    expect(model.classes.map((item) => item.css)).toEqual([['hot'], []]);
  });

  it('reads namespaces and notes', async () => {
    const model = await read(CLASS_FIXTURES.namespaces!);
    expect(model.namespaces).toEqual([
      { id: 'Shapes', label: '' },
      { id: 'Outer', label: '' },
      { id: 'Outer.Inner', label: '' },
    ]);
    expect(model.classes.map((item) => item.ns)).toEqual(['Shapes', 'Shapes', 'Outer.Inner']);
    const notes = await read(CLASS_FIXTURES.notes!);
    expect(notes.notes.map((note) => note.id)).toEqual(['note:-:0', 'note:A:0', 'note:A:1']);
  });

  it('reports other types, invalid code and a wrong db', async () => {
    expect(await parse('erDiagram\n    A ||--o{ B : has\n', loadMermaid)).toEqual({
      kind: 'unsupported',
      message: 'er',
    });
    expect((await parse('classDiagram\n    class A {\n', loadMermaid)).kind).toBe('error');
    expect((await parse('classDiagram\n  A --> B', fakeLoader('classDiagram', {}))).kind).toBe(
      'error',
    );
  });

  it('fills in every field Mermaid leaves out', async () => {
    const db = {
      getClasses: (): Map<string, object> =>
        new Map([['A', { id: 'A', members: [{}], methods: [{}], label: 'A' }]]),
      getNamespaces: (): Map<string, object> => new Map([['N', { id: 'N' }]]),
      getRelations: (): object[] => [
        {
          id1: 'A',
          id2: 'I',
          relation: { type1: 'none', type2: 4, lineType: 0 },
          relationTitle1: 'none',
        },
      ],
      getNotes: (): object[] => [{ text: 'n' }],
      getDirection: (): undefined => undefined,
    };
    expect(await parse('classDiagram\n  A --> B', fakeLoader('classDiagram', db))).toEqual({
      kind: 'ok',
      model: {
        ...emptyModel(),
        classes: [
          {
            id: 'A',
            label: '',
            generic: '',
            annotations: [],
            attrs: [{ vis: '', text: '', cls: '' }],
            methods: [{ vis: '', name: '', params: '', ret: '', cls: '' }],
            css: [],
            ns: '',
          },
        ],
        namespaces: [{ id: 'N', label: '' }],
        relations: [
          {
            id: 'R:A:I:0',
            from: 'A',
            to: 'I',
            t1: 'none',
            t2: 'lolli',
            line: 'solid',
            label: '',
            m1: '',
            m2: '',
          },
        ],
        notes: [{ id: 'note:-:0', text: 'n', for: '', ns: '' }],
      },
    });
  });

  it('rejects an unknown direction', async () => {
    const db = {
      getClasses: (): Map<string, object> => new Map(),
      getNamespaces: (): Map<string, object> => new Map(),
      getRelations: (): object[] => [],
      getNotes: (): object[] => [],
      getDirection: (): string => 'XY',
    };
    expect(await parse('classDiagram\n  A --> B', fakeLoader('classDiagram', db))).toEqual({
      kind: 'error',
      message: 'Unknown class diagram direction "XY"',
    });
  });
});

describe('serialize', () => {
  it('writes the template, moving the classifier next to the parentheses', async () => {
    expect(serialize(await read(CLASS_FIXTURES.template!))).toBe(
      CLASS_FIXTURES.template!.replace('+makeSound() void*', '+makeSound()* void'),
    );
  });

  it('writes namespaces nested by dotted id, with labels and notes', () => {
    const model: ClassModel = {
      ...emptyModel(),
      classes: [
        {
          id: 'A',
          label: '',
          generic: '',
          annotations: [],
          attrs: [],
          methods: [],
          css: [],
          ns: 'X.Y',
        },
      ],
      namespaces: [
        { id: 'X', label: 'Ex' },
        { id: 'Empty', label: '' },
      ],
      notes: [{ id: 'note:-:0', text: 'say "hi"', for: '', ns: 'X' }],
    };
    expect(serialize(model)).toBe(`classDiagram
    namespace X["Ex"] {
        namespace Y {
            class A
        }
        note "say #quot;hi#quot;"
    }
`);
  });

  it('writes extra css classes as cssClass lines', () => {
    const model: ClassModel = {
      ...emptyModel(),
      classes: [
        {
          id: 'A',
          label: '',
          generic: '',
          annotations: [],
          attrs: [],
          methods: [],
          css: ['one', 'two'],
          ns: '',
        },
      ],
    };
    expect(serialize(model)).toBe('classDiagram\n    class A:::one\n    cssClass "A" two\n');
  });
});

describe('relationSource', () => {
  const base: ClassRelation = {
    id: 'r',
    from: 'A',
    to: 'B',
    t1: 'none',
    t2: 'dep',
    line: 'dashed',
    label: '',
    m1: '',
    m2: '',
  };

  it('writes markers, multiplicities and an encoded label', () => {
    expect(relationSource(base)).toBe('A ..> B');
    expect(
      relationSource({
        ...base,
        t1: 'comp',
        t2: 'none',
        line: 'solid',
        m1: '1',
        m2: 'n',
        label: 'a: "b"\nc',
      }),
    ).toBe('A "1" *-- "n" B : a#colon; #quot;b#quot; c');
    expect(relationSource({ ...base, t1: 'lolli', from: 'my iface' })).toBe('my iface ()..> B');
  });
});

describe('ids and kinds', () => {
  it('finds free ids', () => {
    const relation: ClassRelation = {
      id: 'R:A:B:0',
      from: 'A',
      to: 'B',
      t1: 'none',
      t2: 'none',
      line: 'solid',
      label: '',
      m1: '',
      m2: '',
    };
    expect(relationId([relation], 'A', 'B')).toBe('R:A:B:1');
    expect(noteIdFor([{ id: 'note:-:0', text: '', for: '', ns: '' }], '')).toBe('note:-:1');
    const model: ClassModel = {
      ...emptyModel(),
      classes: [
        {
          id: 'Class1',
          label: '',
          generic: '',
          annotations: [],
          attrs: [],
          methods: [],
          css: [],
          ns: '',
        },
      ],
      namespaces: [{ id: 'Namespace1', label: '' }],
    };
    expect(uniqueClassId(model)).toBe('Class2');
    expect(uniqueNsId(model)).toBe('Namespace2');
  });

  it('names the toolbar kind of a relation', () => {
    const relation: ClassRelation = {
      id: 'r',
      from: 'A',
      to: 'B',
      t1: 'none',
      t2: 'ext',
      line: 'solid',
      label: '',
      m1: '',
      m2: '',
    };
    expect(kindOf(relation)).toBe('inheritance');
    expect(kindOf({ ...relation, line: 'dashed' })).toBe('realization');
    expect(kindOf({ ...relation, t2: 'none' })).toBe('link');
    expect(kindOf({ ...relation, t1: 'agg' })).toBe('custom');
    expect(kindOf({ ...relation, t2: 'comp', line: 'dashed' })).toBe('custom');
    expect(kindOf({ ...relation, t1: 'lolli' })).toBe('lollipop');
  });

  it('spots abstract classes', () => {
    const item = {
      id: 'A',
      label: '',
      generic: '',
      annotations: ['Abstract'],
      attrs: [],
      methods: [],
      css: [],
      ns: '',
    };
    expect(isAbstract(item)).toBe(true);
    expect(isAbstract({ ...item, annotations: [] })).toBe(false);
  });

  it('bundles the model functions', () => {
    expect(classEditor).toEqual({ id: 'class', emptyModel, parse, serialize });
  });
});
