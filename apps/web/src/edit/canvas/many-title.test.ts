import { describe, expect, it } from 'vitest';

import { manyTitle } from './many-title.ts';

describe('manyTitle', () => {
  it('names one kind by its plural and a mix as items', () => {
    const nodes = { count: 2, plural: 'nodes' };
    expect(manyTitle([nodes, { count: 0, plural: 'links' }])).toBe('2 nodes');
    expect(manyTitle([nodes, { count: 1, plural: 'links' }])).toBe('3 items');
    expect(manyTitle([])).toBe('0 items');
  });
});
