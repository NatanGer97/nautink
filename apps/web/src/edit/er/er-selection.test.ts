import { describe, expect, it } from 'vitest';

import {
  applyEdgeSelection,
  applyNodeSelection,
  liveSelection,
  nodeMoves,
  selectedItems,
  selectionOfIds,
} from './er-selection.ts';
import { NO_SELECTION } from './er-types.ts';
import { sampleModel } from '../../../tests/er-fixtures.ts';

const GROUPS: ReadonlySet<string> = new Set(['SALES']);

describe('React Flow changes', () => {
  it('selects entities and one group, ignoring other changes', () => {
    const next = applyNodeSelection(
      [
        { type: 'select', id: 'CUSTOMER', selected: true },
        { type: 'select', id: 'SALES', selected: true },
        { type: 'dimensions', id: 'ORDER' },
      ],
      NO_SELECTION,
      GROUPS,
    );
    expect(next).toEqual({ entities: ['CUSTOMER'], rels: [], group: 'SALES' });
    const after = applyNodeSelection(
      [
        { type: 'select', id: 'CUSTOMER', selected: false },
        { type: 'select', id: 'SALES', selected: false },
      ],
      next,
      GROUPS,
    );
    expect(after).toEqual(NO_SELECTION);
  });

  it('keeps another group selected when one it does not hold is deselected', () => {
    const selection = { ...NO_SELECTION, group: 'OTHER' };
    expect(
      applyNodeSelection([{ type: 'select', id: 'SALES', selected: false }], selection, GROUPS),
    ).toBe(selection);
  });

  it('moves entities, never group frames', () => {
    expect(
      nodeMoves(
        [
          { type: 'position', id: 'ORDER', position: { x: 1, y: 2 } },
          { type: 'position', id: 'SALES', position: { x: 1, y: 2 } },
          { type: 'position', id: 'LINE' },
        ],
        GROUPS,
      ),
    ).toEqual([['ORDER', { x: 1, y: 2 }]]);
  });

  it('selects relationships', () => {
    const next = applyEdgeSelection(
      [
        { type: 'select', id: 'R_A', selected: true },
        { type: 'remove', id: 'R_B' },
      ],
      NO_SELECTION,
    );
    expect(next.rels).toEqual(['R_A']);
  });
});

describe('the selection and the model', () => {
  it('drops what an outside change removed', () => {
    expect(
      liveSelection(
        { entities: ['ORDER', 'GONE'], rels: ['R_ORDER_LINE_0', 'R_X'], group: 'X' },
        sampleModel(),
      ),
    ).toEqual({ entities: ['ORDER'], rels: ['R_ORDER_LINE_0'], group: null });
    expect(liveSelection({ ...NO_SELECTION, group: 'SALES' }, sampleModel()).group).toBe('SALES');
    expect(liveSelection({ ...NO_SELECTION, entities: ['ORDER'] }, null)).toEqual(NO_SELECTION);
  });

  it('selects the Mermaid ids Split asks for', () => {
    expect(selectionOfIds(sampleModel(), ['LINE', 'SALES', 'R_CUSTOMER_ORDER_0', 'x'])).toEqual({
      entities: ['LINE'],
      rels: ['R_CUSTOMER_ORDER_0'],
      group: 'SALES',
    });
    expect(selectionOfIds(null, ['LINE'])).toEqual(NO_SELECTION);
  });

  it('reports Mermaid ids, display names and kinds to the app', () => {
    expect(
      selectedItems(sampleModel(), {
        entities: ['ORDER'],
        rels: ['R_ORDER_LINE_0'],
        group: 'SALES',
      }),
    ).toEqual([
      { id: 'ORDER', label: 'Order', kind: 'entity' },
      { id: 'R_ORDER_LINE_0', label: 'Order → LINE', kind: 'relationship' },
      { id: 'SALES', label: 'Sales', kind: 'group' },
    ]);
    expect(selectedItems(null, NO_SELECTION)).toEqual([]);
  });
});
