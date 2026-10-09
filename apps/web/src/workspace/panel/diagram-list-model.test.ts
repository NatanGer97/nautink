import { newDiagram } from '@nautink/storage/diagrams';
import { searchDiagrams } from '@nautink/storage/search';
import { describe, expect, it } from 'vitest';

import {
  ALL_FILTER,
  applyTypeFilter,
  nextCursor,
  PINNED_FILTER,
  typeFilters,
} from './diagram-list-model.ts';

const diagrams = [
  newDiagram({ id: 'a', code: 'flowchart TD', updatedAt: 3 }),
  newDiagram({ id: 'b', code: 'sequenceDiagram', updatedAt: 2, pinned: true }),
  newDiagram({ id: 'c', code: 'flowchart LR', updatedAt: 1 }),
  newDiagram({ id: 'd', code: 'classDiagram', updatedAt: 0 }),
];

describe('typeFilters', () => {
  it('lists All, Pinned, then the types present by use', () => {
    expect(typeFilters(diagrams)).toEqual(['All', 'Pinned', 'Flowchart', 'Class', 'Sequence']);
    expect(typeFilters([diagrams[0]!])).toEqual(['All', 'Flowchart']);
  });
});

describe('applyTypeFilter', () => {
  const hits = searchDiagrams(diagrams, '');

  it('keeps every hit, the pinned ones, or one type', () => {
    expect(applyTypeFilter(hits, ALL_FILTER)).toHaveLength(4);
    expect(applyTypeFilter(hits, PINNED_FILTER).map((hit) => hit.diagram.id)).toEqual(['b']);
    expect(applyTypeFilter(hits, 'Flowchart').map((hit) => hit.diagram.id)).toEqual(['a', 'c']);
  });
});

describe('nextCursor', () => {
  const ids = ['a', 'b', 'c'];

  it('moves with the arrows and stops at the ends', () => {
    expect(nextCursor(ids, null, 'ArrowDown')).toBe('a');
    expect(nextCursor(ids, 'gone', 'ArrowUp')).toBe('a');
    expect(nextCursor(ids, 'a', 'ArrowDown')).toBe('b');
    expect(nextCursor(ids, 'a', 'ArrowUp')).toBe('a');
    expect(nextCursor(ids, 'c', 'ArrowDown')).toBe('c');
  });

  it('jumps with Home and End, and ignores other keys', () => {
    expect(nextCursor(ids, 'b', 'Home')).toBe('a');
    expect(nextCursor(ids, 'b', 'End')).toBe('c');
    expect(nextCursor(ids, 'b', 'x')).toBeUndefined();
  });
});
