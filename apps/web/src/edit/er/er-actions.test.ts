import { emptyModel, serialize } from '@nautink/editors/er/model';
import { describe, expect, it } from 'vitest';

import {
  addAttribute,
  addEntity,
  connect,
  deletedNames,
  deleteSelection,
  moveAttribute,
  removeAttribute,
  renameEntity,
  renameFromHeader,
  reverseRel,
  setDirection,
  setEntityGroup,
  setRelLabel,
  toggleKey,
  ungroup,
  updateAttribute,
  updateEntity,
  updateGroup,
  updateRel,
} from './er-actions.ts';
import { NO_SELECTION } from './er-types.ts';
import { erTestContext, sampleModel } from '../../../tests/er-fixtures.ts';

import type { ErActionContext } from './er-actions.ts';

describe('addEntity', () => {
  it('adds ENTITY with an id key in free space, selects it and starts renaming', () => {
    const context = erTestContext();
    addEntity(context, { at: { x: 0, y: 0 } });
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Added entity ENTITY');
    expect(context.model().entities.at(-1)).toEqual({
      name: 'ENTITY',
      alias: '',
      attributes: [{ type: 'int', name: 'id', keys: ['PK'], comment: '' }],
      classes: [],
    });
    expect(context.stored().ENTITY).toBeDefined();
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, entities: ['ENTITY'] });
    expect(context.setEditingId).toHaveBeenLastCalledWith('ENTITY');
  });

  it('relates a dropped link’s entity to its source, inside the source’s group, under the drop', () => {
    const context = erTestContext();
    addEntity(context, { at: { x: 500, y: 300 }, connectFrom: 'ORDER' });
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Added entity ENTITY related to Order',
    );
    expect(context.model().subgraphs[0]?.members).toContain('ENTITY');
    expect(context.model().rels.at(-1)).toMatchObject({ from: 'ORDER', to: 'ENTITY' });
    expect(context.stored().ENTITY?.y).toBe(300);
  });
});

describe('renaming', () => {
  it('renames an entity everywhere and moves its spot', () => {
    const context = erTestContext();
    expect(renameEntity(context, 'CUSTOMER', 'CLIENT')).toBe(true);
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Renamed CUSTOMER → CLIENT',
    );
    expect(context.model().rels[0]?.from).toBe('CLIENT');
    expect(context.stored().CLIENT).toEqual({ x: 0, y: 0 });
    expect(context.stored().CUSTOMER).toBeUndefined();
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, entities: ['CLIENT'] });
  });

  it('records nothing for a taken or empty name', () => {
    const context = erTestContext();
    expect(renameEntity(context, 'CUSTOMER', 'LINE')).toBe(false);
    expect(renameEntity(context, 'CUSTOMER', '  ')).toBe(false);
    expect(context.commits).not.toHaveBeenCalled();
  });

  it('keeps positions as they are when the entity had no spot', () => {
    const context = erTestContext();
    context.positions.replace({});
    renameEntity(context, 'LINE', 'ITEM');
    expect(context.stored()).toEqual({});
  });

  it('renames from the header: the alias when there is one, the name otherwise', () => {
    const context = erTestContext();
    renameFromHeader(context, 'ORDER', ' Purchase ');
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Renamed Order → Purchase');
    expect(context.model().entities[1]?.alias).toBe('Purchase');
    renameFromHeader(context, 'LINE', 'ITEM');
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Renamed LINE → ITEM');
  });

  it('ignores a header rename that changes nothing', () => {
    const context = erTestContext();
    renameFromHeader(context, 'ORDER', 'Order');
    renameFromHeader(context, 'LINE', '');
    renameFromHeader(context, 'MISSING', 'X');
    expect(context.commits).not.toHaveBeenCalled();
  });
});

describe('entity and attribute edits', () => {
  it('labels every edit after what it changed', () => {
    const context = erTestContext();
    updateEntity(context, 'LINE', { alias: 'Line item' });
    addAttribute(context, 'LINE');
    updateAttribute(context, { entityName: 'CUSTOMER', index: 1, patch: { name: 'mail' } });
    toggleKey(context, { entityName: 'CUSTOMER', index: 1, key: 'FK' });
    moveAttribute(context, { entityName: 'CUSTOMER', index: 1, delta: -1 });
    removeAttribute(context, { entityName: 'CUSTOMER', index: 0 });
    expect(context.commits.mock.calls.map(([, label]) => label)).toEqual([
      'Renamed LINE → Line item',
      'Added attribute to Line item',
      'Edited attribute of CUSTOMER',
      'Toggled FK in CUSTOMER',
      'Reordered attributes of CUSTOMER',
      'Removed attribute from CUSTOMER',
    ]);
    expect(context.model().entities[0]?.attributes).toEqual([
      { type: 'int', name: 'id', keys: ['PK'], comment: '' },
    ]);
  });

  it('moves an entity into and out of a group', () => {
    const context = erTestContext();
    setEntityGroup(context, 'CUSTOMER', 'SALES');
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Moved CUSTOMER into Sales',
    );
    setEntityGroup(context, 'CUSTOMER', null);
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Moved CUSTOMER out of its group',
    );
  });
});

describe('relationships', () => {
  it('edits cardinality, line and label as labelled steps', () => {
    const context = erTestContext();
    updateRel(context, 'R_CUSTOMER_ORDER_0', { toCard: 'ONE_OR_MORE' });
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Changed cardinality of CUSTOMER → Order',
    );
    setRelLabel(context, 'R_CUSTOMER_ORDER_0', 'buys');
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Labelled relationship CUSTOMER → Order',
    );
    expect(serialize(context.model())).toContain('CUSTOMER ||--|{ ORDER : buys');
  });

  it('records nothing when the inline label did not change', () => {
    const context = erTestContext();
    setRelLabel(context, 'R_CUSTOMER_ORDER_0', 'places');
    setRelLabel(context, 'R_MISSING', 'x');
    expect(context.commits).not.toHaveBeenCalled();
  });

  it('reverses a relationship and keeps it selected under its new id', () => {
    const context = erTestContext();
    reverseRel(context, 'R_CUSTOMER_ORDER_0');
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Reversed relationship CUSTOMER → Order',
    );
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, rels: ['R_ORDER_CUSTOMER_0'] });
  });

  it('connects two entities and selects the new relationship', () => {
    const context = erTestContext();
    connect(context, 'CUSTOMER', 'LINE');
    expect(context.commits).toHaveBeenLastCalledWith(
      expect.anything(),
      'Connected CUSTOMER → LINE',
    );
    expect(context.selections.at(-1)).toEqual({ ...NO_SELECTION, rels: ['R_CUSTOMER_LINE_0'] });
  });
});

describe('groups, delete and direction', () => {
  it('retitles and ungroups a group', () => {
    const context = erTestContext();
    updateGroup(context, 'SALES', { title: 'Orders' });
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Renamed Sales → Orders');
    ungroup(context, 'SALES');
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Ungrouped Orders');
    expect(context.model().subgraphs).toEqual([]);
    expect(context.selections.at(-1)).toEqual(NO_SELECTION);
  });

  it('names a delete without the relationships that go with their entities', () => {
    const model = sampleModel();
    expect(
      deletedNames(model, {
        entities: ['ORDER'],
        rels: ['R_CUSTOMER_ORDER_0', 'R_MISSING'],
        group: 'SALES',
      }),
    ).toEqual(['Order', 'Sales']);
    expect(deletedNames(model, { ...NO_SELECTION, rels: ['R_ORDER_LINE_0'] })).toEqual([
      'relationship Order → LINE',
    ]);
  });

  it('deletes the selection as one step, and nothing when it is empty', () => {
    const context = erTestContext();
    deleteSelection(context, NO_SELECTION);
    expect(context.commits).not.toHaveBeenCalled();
    deleteSelection(context, { ...NO_SELECTION, entities: ['LINE'] });
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Deleted LINE');
    expect(context.model().rels).toHaveLength(1);
    deleteSelection(context, { ...NO_SELECTION, group: 'SALES' });
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Deleted Sales');
  });

  it('changes direction, lays out again and fits', () => {
    const context = erTestContext();
    setDirection(context, 'TB');
    expect(context.commits).not.toHaveBeenCalled();
    setDirection(context, 'LR');
    expect(context.commits).toHaveBeenLastCalledWith(expect.anything(), 'Changed direction to LR');
    expect(context.model().direction).toBe('LR');
    expect(context.requestFit).toHaveBeenCalled();
  });
});

describe('without a model', () => {
  it('does nothing', () => {
    const context: ErActionContext = { ...erTestContext(emptyModel()), getModel: () => null };
    addEntity(context, { at: { x: 0, y: 0 } });
    reverseRel(context, 'R');
    connect(context, 'A', 'B');
    setDirection(context, 'LR');
    updateGroup(context, 'G', { title: 'x' });
    expect(renameEntity(context, 'A', 'B')).toBe(false);
    expect(context.commit).not.toHaveBeenCalled();
  });
});
