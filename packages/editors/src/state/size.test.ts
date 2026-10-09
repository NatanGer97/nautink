import { describe, expect, it } from 'vitest';

import { nodeSize, PALETTE } from './size.ts';

describe('nodeSize', () => {
  it('gives pseudo states and bars their fixed size', () => {
    expect(nodeSize({ kind: 'start', isLoose: false, title: '' })).toEqual({
      width: 22,
      height: 22,
    });
    expect(nodeSize({ kind: 'end', isLoose: true, title: '' })).toEqual({ width: 26, height: 26 });
    expect(nodeSize({ kind: 'choice', isHorizontal: true, title: '' })).toEqual({
      width: 34,
      height: 34,
    });
    expect(nodeSize({ kind: 'fork', isHorizontal: true, title: '' })).toEqual({
      width: 90,
      height: 10,
    });
    expect(nodeSize({ kind: 'join', isHorizontal: false, title: '' })).toEqual({
      width: 10,
      height: 90,
    });
  });

  it('sizes states from their label and description', () => {
    expect(nodeSize({ kind: 'state', label: 'A', desc: [] })).toEqual({ width: 96, height: 40 });
    expect(nodeSize({ kind: 'state', label: 'x'.repeat(60), desc: ['d'.repeat(80)] })).toEqual({
      width: 280,
      height: 118,
    });
  });

  it('sizes empty composites and notes', () => {
    expect(nodeSize({ kind: 'emptyComposite', label: 'Box' })).toEqual({ width: 170, height: 80 });
    expect(nodeSize({ kind: 'note', text: '', target: 'A', side: 'left' })).toEqual({
      width: 80,
      height: 32,
    });
    expect(
      nodeSize({ kind: 'note', text: `${'n'.repeat(50)}\nb`, target: 'A', side: 'left' }),
    ).toEqual({ width: 240, height: 64 });
  });

  it('has a palette entry per kind', () => {
    expect(PALETTE.map((item) => item.kind)).toEqual([
      'state',
      'start',
      'end',
      'choice',
      'fork',
      'join',
      'composite',
      'note',
    ]);
  });
});
