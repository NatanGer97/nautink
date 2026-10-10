import { describe, expect, it } from 'vitest';

import {
  countChanges,
  pairElements,
  removedRefs,
  reviewTargets,
  signature,
} from './review-element.ts';

import type { ReviewElement } from './review-element.ts';

function node(id: string, sig: string = '', key: string = `node:${id}`): ReviewElement {
  return { id, kind: 'node', key, sig, label: id };
}

function edge(id: string, sig: string): ReviewElement {
  return { id, kind: 'edge', key: 'edge:A>B', sig, label: sig, ends: ['A', 'B'] };
}

describe('signature', () => {
  it('ignores key order and keeps arrays and nulls as they are', () => {
    expect(signature({ b: 1, a: [2, { d: null, c: 3 }] })).toBe(
      signature({ a: [2, { c: 3, d: null }], b: 1 }),
    );
    expect(signature({ a: 1 })).not.toBe(signature({ a: 2 }));
    expect(signature('text')).toBe('"text"');
  });
});

describe('pairElements', () => {
  it('pairs equal elements first, then the rest of a key in order', () => {
    const before: ReviewElement[] = [edge('L0', 'x'), edge('L1', 'y')];
    const after: ReviewElement[] = [edge('L0', 'y'), edge('L1', 'z'), edge('L2', 'w')];
    const pairs = pairElements(before, after).map(([b, a]) => [b?.sig ?? null, a?.sig ?? null]);
    expect(pairs).toEqual([
      ['y', 'y'],
      ['x', 'z'],
      [null, 'w'],
    ]);
  });

  it('keeps an element alone when the other side has no such key', () => {
    const pairs = pairElements([node('A')], [node('B')]);
    expect(pairs.map(([b, a]) => [b?.id ?? null, a?.id ?? null])).toEqual([
      ['A', null],
      [null, 'B'],
    ]);
  });
});

describe('countChanges and removedRefs', () => {
  const before: ReviewElement[] = [node('A'), node('B', 'old'), node('C'), edge('L0', 'x')];
  const after: ReviewElement[] = [node('A'), node('B', 'new'), node('D'), edge('L0', 'x')];

  it('counts added, changed and removed elements', () => {
    expect(countChanges(before, after)).toEqual({ added: 1, changed: 1, removed: 1 });
    expect(countChanges(after, after)).toEqual({ added: 0, changed: 0, removed: 0 });
  });

  it('names the removed elements by kind and id', () => {
    expect([...removedRefs(before, after)]).toEqual(['node:C']);
  });
});

describe('reviewTargets', () => {
  it('marks the shown elements against the proposal, with their order per kind', () => {
    const before: ReviewElement[] = [node('A'), node('B', 'old'), node('C'), edge('L0', 'x')];
    const after: ReviewElement[] = [node('A'), node('B', 'new'), node('D'), edge('L0', 'y')];
    const shown: ReviewElement[] = [...after, node('C')];
    const targets = reviewTargets(shown, { before, after });
    expect(targets.map(({ id, mark, order }) => [id, mark, order])).toEqual([
      ['B', 'changed', 1],
      ['D', 'added', 2],
      ['L0', 'changed', 0],
      ['C', 'removed', 3],
    ]);
  });

  it('marks nothing when the proposal changes nothing', () => {
    const elements: ReviewElement[] = [node('A')];
    expect(reviewTargets(elements, { before: elements, after: elements })).toEqual([]);
  });
});
