import { describe, expect, it } from 'vitest';

import { classBoxes, framedIds, isInside } from './class-boxes.ts';
import { classEdges, handlesFor } from './class-edges.ts';
import { classNodes } from './class-elements.ts';
import { NO_SELECTION } from './class-types.ts';
import { sampleModel } from '../../../tests/class-fixtures.ts';

import type { ClassModel } from '@nautink/editors/class/types';

const POSITIONS = {
  Animal: { x: 0, y: 0 },
  Dog: { x: 0, y: 200 },
  Bone: { x: 300, y: 200 },
  'note:Dog:0': { x: 200, y: 300 },
};

function withLollipop(): ClassModel {
  const model = sampleModel();
  return {
    ...model,
    relations: [
      ...model.relations,
      {
        ...model.relations[0]!,
        id: 'R:IFace:Animal:0',
        from: 'IFace',
        to: 'Animal',
        t1: 'lolli',
        t2: 'none',
      },
      { ...model.relations[0]!, id: 'R:Bone:Bone:0', from: 'Bone', to: 'Bone' },
    ],
  };
}

describe('classBoxes', () => {
  it('boxes every item and wraps namespaces around their content', () => {
    const boxes = classBoxes(sampleModel(), POSITIONS);
    const dog = boxes.get('Dog')!;
    expect(dog).toMatchObject({ x: 0, y: 200 });
    expect(boxes.get('ns:Zoo')).toEqual({ x: -20, y: 200 - 42, w: dog.w + 40, h: dog.h + 62 });
  });

  it('nests frames and skips namespaces with nothing in them', () => {
    const model: ClassModel = {
      ...sampleModel(),
      namespaces: [{ id: 'Empty', label: '' }],
      classes: sampleModel().classes.map((item) =>
        item.id === 'Dog' ? { ...item, ns: 'A.B' } : item,
      ),
    };
    const boxes = classBoxes(model, {});
    expect(boxes.get('ns:A')!.w).toBeGreaterThan(boxes.get('ns:A.B')!.w);
    expect(boxes.has('ns:Empty')).toBe(false);
    expect(framedIds(model, 'A')).toEqual(['Dog']);
    expect(isInside('A.B', 'A')).toBe(true);
    expect(isInside('AB', 'A')).toBe(false);
  });
});

describe('classNodes', () => {
  it('draws frames under classes, notes and lollipops, with styles and selection', () => {
    const model: ClassModel = { ...withLollipop(), extra: ['style Bone fill:#000000'] };
    const nodes = classNodes({
      model,
      positions: POSITIONS,
      selection: { nodes: ['Dog'], edges: [], group: 'Zoo' },
      isReadOnly: true,
    });
    expect(nodes.map((node) => [node.id, node.type])).toEqual([
      ['ns:Zoo', 'nsframe'],
      ['Animal', 'cls'],
      ['Dog', 'cls'],
      ['Bone', 'cls'],
      ['note:Dog:0', 'note'],
      ['lolli:R:IFace:Animal:0', 'lolli'],
    ]);
    expect(nodes[0]).toMatchObject({ selected: true, draggable: false, data: { title: 'Zoo' } });
    expect(nodes[2]?.selected).toBe(true);
    expect(nodes[3]?.data).toMatchObject({ style: { '--node-fill': '#000000' } });
    expect(nodes[5]?.data).toEqual({ label: 'IFace' });
  });

  it('titles a frame with its label, and a lollipop on the target end with its label', () => {
    const model = withLollipop();
    model.namespaces[0]!.label = 'The zoo';
    model.relations[2] = {
      ...model.relations[2]!,
      from: 'Animal',
      to: 'Port',
      t1: 'none',
      t2: 'lolli',
    };
    const nodes = classNodes({ model, positions: {}, selection: NO_SELECTION, isReadOnly: false });
    expect(nodes[0]?.data).toMatchObject({ title: 'The zoo' });
    expect(nodes.at(-1)?.data).toEqual({ label: 'Port' });
  });
});

describe('classEdges', () => {
  it('attaches links to the facing sides, with UML ends, texts and a fan-out', () => {
    const model = withLollipop();
    const edges = classEdges(model, classBoxes(model, POSITIONS), {
      ...NO_SELECTION,
      edges: ['R:Dog:Bone:0'],
    });
    const chews = edges.find((edge) => edge.id === 'R:Dog:Bone:0')!;
    expect(chews).toMatchObject({
      source: 'Dog',
      target: 'Bone',
      sourceHandle: 'r',
      targetHandle: 'l',
      selected: true,
    });
    expect(chews.data).toMatchObject({ t2: 'dep', label: 'chews', m1: '1', m2: '*' });
    const lolli = edges.find((edge) => edge.id === 'R:IFace:Animal:0')!;
    expect(lolli).toMatchObject({ source: 'lolli:R:IFace:Animal:0', data: { t1: 'none' } });
    const self = edges.find((edge) => edge.id === 'R:Bone:Bone:0')!;
    expect(self).toMatchObject({ sourceHandle: 'r', targetHandle: 't', data: { isSelf: true } });
    expect(edges.find((edge) => edge.id === 'link:note:Dog:0')).toMatchObject({
      type: 'notelink',
      target: 'Dog',
    });
  });

  it('fans out several links on one side of a box', () => {
    const model = sampleModel();
    model.relations.push({ ...model.relations[0]!, id: 'R:Animal:Bone:0', to: 'Bone' });
    const edges = classEdges(
      model,
      classBoxes(model, { ...POSITIONS, Bone: { x: 0, y: 400 } }),
      NO_SELECTION,
    );
    const offsets = edges
      .filter((edge) => edge.source === 'Animal')
      .map((edge) => (edge.data as { sourceOffset: number }).sourceOffset);
    expect(offsets).toEqual([-9, 9]);
  });

  it('skips relations and note links whose ends are not on the canvas', () => {
    const model = sampleModel();
    model.notes.push({ id: 'note:-:0', text: 'free', for: '', ns: '' });
    const edges = classEdges(model, new Map(), NO_SELECTION);
    expect(edges).toEqual([]);
  });
});

describe('handlesFor', () => {
  it('prefers vertical links between wide boxes', () => {
    const a = { x: 0, y: 0, w: 200, h: 50 };
    expect(handlesFor(a, { x: 150, y: 100, w: 200, h: 50 })).toEqual(['b', 't']);
    expect(handlesFor(a, { x: 0, y: -100, w: 200, h: 50 })).toEqual(['t', 'b']);
    expect(handlesFor(a, { x: 500, y: 0, w: 200, h: 50 })).toEqual(['r', 'l']);
    expect(handlesFor(a, { x: -500, y: 0, w: 200, h: 50 })).toEqual(['l', 'r']);
  });
});
