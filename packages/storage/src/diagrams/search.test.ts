import { describe, expect, it } from 'vitest';

import { compareDiagrams, sortDiagrams } from './diagram-order.ts';
import { findLine, searchDiagrams } from './search.ts';

import type { Diagram } from '../db/records.ts';

function diagram(fields: Partial<Diagram> & Pick<Diagram, 'id'>): Diagram {
  return {
    title: '',
    titleAuto: true,
    code: '',
    view: 'preview',
    messages: [],
    sessionId: null,
    pinned: false,
    draft: '',
    createdAt: 0,
    updatedAt: 0,
    ...fields,
  };
}

const login = diagram({
  id: 'login',
  title: 'Login flow',
  code: 'flowchart TD\n  A[Start] --> B',
  updatedAt: 3,
});
const orders = diagram({
  id: 'orders',
  title: 'Orders',
  code: 'erDiagram\n    CUSTOMER ||--o{ ORDER : places',
  updatedAt: 1,
  pinned: true,
});
const pets = diagram({
  id: 'pets',
  title: 'Pets',
  code: 'pie title Pets\n  "Dogs": 3',
  updatedAt: 2,
});

describe('diagram order', () => {
  it('puts pinned diagrams first, then the most recently updated', () => {
    expect(sortDiagrams([login, orders, pets]).map((d) => d.id)).toEqual([
      'orders',
      'login',
      'pets',
    ]);
    expect(compareDiagrams(login, login)).toBe(0);
  });
});

describe('searchDiagrams', () => {
  it('keeps every diagram, sorted, for a blank query', () => {
    expect(searchDiagrams([login, pets, orders], '  ')).toEqual([
      { diagram: orders, matchedIn: 'none' },
      { diagram: login, matchedIn: 'none' },
      { diagram: pets, matchedIn: 'none' },
    ]);
  });

  it('matches titles case-insensitively before content', () => {
    expect(searchDiagrams([login, pets, orders], 'PETS')).toEqual([
      { diagram: pets, matchedIn: 'title' },
    ]);
  });

  it('matches content and reports the trimmed line and match span', () => {
    expect(searchDiagrams([login, pets, orders], 'customer')).toEqual([
      {
        diagram: orders,
        matchedIn: 'content',
        match: { line: 'CUSTOMER ||--o{ ORDER : places', start: 0, end: 8 },
      },
    ]);
  });

  it('returns nothing when no diagram matches', () => {
    expect(searchDiagrams([login, pets, orders], 'zebra')).toEqual([]);
  });
});

describe('findLine', () => {
  it('finds the first matching line', () => {
    expect(findLine('a\n   bXc\nbx', 'x')).toEqual({ line: 'bXc', start: 1, end: 2 });
    expect(findLine('abc', 'z')).toBeUndefined();
  });
});
