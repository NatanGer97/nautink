import { emptyModel } from '@nautink/editors/class/model';
import { vi } from 'vitest';

import type { ClassActionContext } from '../src/edit/class/class-action-context.ts';
import type { ClassEditing, ClassSelection } from '../src/edit/class/class-types.ts';
import type { ClassModel } from '@nautink/editors/class/types';
import type { PositionMap } from '@nautink/visual-core/positions';
import type { Mock } from 'vitest';

const EMPTY_CLASS = {
  label: '',
  generic: '',
  annotations: [],
  attrs: [],
  methods: [],
  css: [],
  ns: '',
};

/** Animal (abstract, one attribute and method) ◁— Dog, Dog → Bone, a note on Dog, Zoo namespace. */
export function sampleModel(): ClassModel {
  return {
    ...emptyModel(),
    classes: [
      {
        ...EMPTY_CLASS,
        id: 'Animal',
        annotations: ['abstract'],
        attrs: [{ vis: '+', text: 'String name', cls: '' }],
        methods: [{ vis: '+', name: 'speak', params: '', ret: 'void', cls: '*' }],
      },
      { ...EMPTY_CLASS, id: 'Dog', ns: 'Zoo' },
      { ...EMPTY_CLASS, id: 'Bone', label: 'Chew toy' },
    ],
    namespaces: [{ id: 'Zoo', label: '' }],
    relations: [
      {
        id: 'R:Animal:Dog:0',
        from: 'Animal',
        to: 'Dog',
        t1: 'ext',
        t2: 'none',
        line: 'solid',
        label: '',
        m1: '',
        m2: '',
      },
      {
        id: 'R:Dog:Bone:0',
        from: 'Dog',
        to: 'Bone',
        t1: 'none',
        t2: 'dep',
        line: 'solid',
        label: 'chews',
        m1: '1',
        m2: '*',
      },
    ],
    notes: [{ id: 'note:Dog:0', text: 'Good boy', for: 'Dog', ns: '' }],
  };
}

export interface ClassTestContext extends ClassActionContext {
  model: () => ClassModel;
  commits: Mock<(next: ClassModel, label: string) => void>;
  selections: ClassSelection[];
  editings: (ClassEditing | null)[];
  stored: () => PositionMap;
}

/** An action context over a model that commits in place, with positions in memory. */
export function classContext(start: ClassModel | null = sampleModel()): ClassTestContext {
  let model: ClassModel | null = start;
  let positions: PositionMap = {
    Animal: { x: 0, y: 0 },
    Dog: { x: 0, y: 200 },
    Bone: { x: 300, y: 200 },
    'note:Dog:0': { x: 200, y: 300 },
  };
  const selections: ClassSelection[] = [];
  const editings: (ClassEditing | null)[] = [];
  const commits = vi.fn((next: ClassModel) => {
    model = next;
  });
  return {
    model: () => model!,
    getModel: () => model,
    commit: commits,
    commits,
    positions: {
      get: () => positions,
      set: (id, point): void => {
        positions = { ...positions, [id]: { ...positions[id], ...point } };
      },
      replace: (next): void => {
        positions = next;
      },
    },
    stored: () => positions,
    select: (selection): void => {
      selections.push(selection);
    },
    selections,
    setEditing: (editing): void => {
      editings.push(editing);
    },
    editings,
    requestFit: vi.fn(),
  };
}
