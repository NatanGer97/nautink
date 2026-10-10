import { describe, expect, it, vi } from 'vitest';

import { changedBlocks, computeReview, TEXT_ONLY } from './compute-review.ts';
import { loadReview } from './load-review.ts';
import { diffLines } from '../history/line-diff.ts';

describe('computeReview', () => {
  it('reviews a visual type on the canvas', async () => {
    const review = await computeReview('flowchart TD\n  A --> B', 'flowchart TD\n  A --> C');
    expect(review.kind).toBe('structural');
    expect(review.kind === 'structural' && review.counts).toEqual({
      added: 2,
      changed: 0,
      removed: 2,
    });
  });

  it('reviews a type without an editor, and a text-only change, as code', async () => {
    const pie = await computeReview('pie\n  "A" : 1', 'pie\n  "A" : 1\n  "B" : 2');
    expect(pie).toEqual({
      kind: 'code',
      reason: 'This diagram type has no visual editor.',
      changes: 1,
    });
    const reordered = await computeReview(
      'flowchart TD\n  A --> B\n  %% note',
      'flowchart TD\n  %% note\n  A --> B',
    );
    expect(reordered).toMatchObject({ kind: 'code', reason: TEXT_ONLY });
  });

  it('counts blocks of changed lines', () => {
    expect(changedBlocks(diffLines('a\nb\nc\nd', 'x\nb\ny\nz'))).toBe(2);
    expect(changedBlocks(diffLines('a', 'a'))).toBe(0);
  });
});

describe('loadReview', () => {
  it('loads the comparison on demand', async () => {
    const review = await loadReview('pie\n  "A" : 1', 'pie\n  "B" : 1');
    expect(review.kind).toBe('code');
  });

  it('falls back to a code review when the comparison fails', async () => {
    vi.resetModules();
    vi.doMock('./compute-review.ts', () => ({
      computeReview: async (): Promise<never> => Promise.reject(new Error('Parser crashed.')),
    }));
    const { loadReview: load } = await import('./load-review.ts');
    expect(await load('a', 'b')).toEqual({
      kind: 'code',
      reason: 'Could not compare the diagrams. Parser crashed.',
      changes: 1,
    });
    vi.doUnmock('./compute-review.ts');
  });
});
