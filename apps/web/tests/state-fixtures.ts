import { emptyModel } from '@nautink/editors/state/model';
import { vi } from 'vitest';

import type { StateActionContext } from '../src/edit/state/state-actions.ts';
import type { StateSelection } from '../src/edit/state/state-types.ts';
import type { StateModel, StateNode } from '@nautink/editors/state/types';
import type { PositionMap } from '@nautink/visual-core/positions';
import type { Mock } from 'vitest';

function state(
  id: string,
  parent: string | null = null,
  patch: Partial<StateNode> = {},
): StateNode {
  return {
    id,
    type: 'state',
    isComposite: false,
    regions: 0,
    name: '',
    desc: [],
    parent,
    classes: [],
    dir: '',
    ...patch,
  };
}

/** [*] → Idle → Busy (label "go"), Busy → [*]; composite Box holding Inner; a note on Idle. */
export function sampleModel(): StateModel {
  return {
    ...emptyModel(),
    states: [
      state('Idle'),
      state('Busy'),
      state('Box', null, { isComposite: true }),
      state('Inner', 'Box'),
    ],
    transitions: [
      { id: 't0', from: 'start:', to: 'Idle', label: '' },
      { id: 't1', from: 'Idle', to: 'Busy', label: 'go' },
      { id: 't2', from: 'Busy', to: 'end:', label: '' },
    ],
    notes: [{ id: 'note:Idle:0', target: 'Idle', side: 'right', text: 'Waits' }],
  };
}

/** Spots for every leaf of `sampleModel`, far enough apart not to overlap. */
export function samplePositions(): PositionMap {
  return {
    'start:': { x: 0, y: 0 },
    Idle: { x: 0, y: 100 },
    Busy: { x: 0, y: 250 },
    'end:': { x: 0, y: 400 },
    Inner: { x: 400, y: 100 },
    'note:Idle:0': { x: 150, y: 100 },
  };
}

export interface StateTestContext extends StateActionContext {
  model: () => StateModel;
  commits: Mock<(next: StateModel, label: string) => void>;
  shown: StateModel[];
  selections: StateSelection[];
  editing: Mock<(id: string | null) => void>;
  stored: () => PositionMap;
}

/** An action context over a model that commits in place, with positions in memory. */
export function stateContext(
  start: StateModel = sampleModel(),
  positions: PositionMap = samplePositions(),
): StateTestContext {
  let model: StateModel = start;
  let stored: PositionMap = positions;
  const selections: StateSelection[] = [];
  const shown: StateModel[] = [];
  const editing = vi.fn<(id: string | null) => void>();
  const commits = vi.fn((next: StateModel) => {
    model = next;
  });
  const replace = (next: PositionMap): void => {
    stored = next;
  };
  return {
    model: () => model,
    getModel: () => model,
    commit: commits,
    commits,
    setModel: (next): void => {
      model = next;
      shown.push(next);
    },
    shown,
    positions: {
      get: () => stored,
      set: (id, point): void => {
        replace({ ...stored, [id]: { ...stored[id], ...point } });
      },
      move: (ids, delta): void => {
        const next: PositionMap = { ...stored };
        for (const id of ids) {
          const at = next[id];
          if (at !== undefined) {
            next[id] = { ...at, x: at.x + delta.x, y: at.y + delta.y };
          }
        }
        replace(next);
      },
      replace,
    },
    stored: () => stored,
    select: (selection): void => {
      selections.push(selection);
    },
    selections,
    setEditingId: editing,
    editing,
    requestFit: vi.fn(),
  };
}
