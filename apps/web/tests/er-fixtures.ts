import { emptyModel } from '@nautink/editors/er/model';
import { vi } from 'vitest';

import type { ErActionContext } from '../src/edit/er/er-actions.ts';
import type { ErCanvasSelection } from '../src/edit/er/er-types.ts';
import type { ErModel } from '@nautink/editors/er/model';
import type { PositionMap } from '@nautink/visual-core/positions';
import type { Mock } from 'vitest';

/** CUSTOMER ||--o{ ORDER ||--|{ LINE, with ORDER and LINE inside group SALES; ORDER has an alias. */
export function sampleModel(): ErModel {
  return {
    ...emptyModel(),
    entities: [
      {
        name: 'CUSTOMER',
        alias: '',
        attributes: [
          { type: 'int', name: 'id', keys: ['PK'], comment: '' },
          { type: 'string', name: 'email', keys: ['UK'], comment: 'login' },
        ],
        classes: [],
      },
      { name: 'ORDER', alias: 'Order', attributes: [], classes: ['hot'] },
      { name: 'LINE', alias: '', attributes: [], classes: [] },
    ],
    rels: [
      {
        id: 'R_CUSTOMER_ORDER_0',
        from: 'CUSTOMER',
        to: 'ORDER',
        fromCard: 'ONLY_ONE',
        toCard: 'ZERO_OR_MORE',
        isIdentifying: true,
        label: 'places',
      },
      {
        id: 'R_ORDER_LINE_0',
        from: 'ORDER',
        to: 'LINE',
        fromCard: 'ONLY_ONE',
        toCard: 'ONE_OR_MORE',
        isIdentifying: false,
        label: 'contains',
      },
    ],
    subgraphs: [{ id: 'SALES', title: 'Sales', members: ['ORDER', 'LINE'], dir: '', classes: [] }],
  };
}

export interface ErTestContext extends ErActionContext {
  model: () => ErModel;
  commits: Mock<(next: ErModel, label: string) => void>;
  selections: ErCanvasSelection[];
  stored: () => PositionMap;
}

/** An action context over a model that commits in place, with positions in memory. */
export function erTestContext(start: ErModel = sampleModel()): ErTestContext {
  let model: ErModel = start;
  let positions: PositionMap = {
    CUSTOMER: { x: 0, y: 0 },
    ORDER: { x: 0, y: 200 },
    LINE: { x: 0, y: 400 },
  };
  const selections: ErCanvasSelection[] = [];
  const commits = vi.fn((next: ErModel) => {
    model = next;
  });
  return {
    model: () => model,
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
    setEditingId: vi.fn(),
    requestFit: vi.fn(),
  };
}
