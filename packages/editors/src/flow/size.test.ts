import { describe, expect, it } from 'vitest';

import { labelLines, NO_LABEL, nodeSize } from './size.ts';

describe('labelLines', () => {
  it('breaks on <br> and newlines', () => {
    expect(labelLines('a<br/>b\nc<BR>d')).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('nodeSize', () => {
  it('sizes a box from its label within the min and max width', () => {
    expect(nodeSize({ shape: 'rect', label: 'A' })).toEqual({ width: 90, height: 44 });
    expect(nodeSize({ shape: 'rect', label: 'x'.repeat(100) })).toEqual({ width: 280, height: 44 });
    expect(nodeSize({ shape: 'rect', label: 'a<br>b<br>c' })).toEqual({ width: 90, height: 78 });
  });

  it('grows shapes that need room for their outline', () => {
    expect(nodeSize({ shape: 'diam', label: 'A' })).toEqual({ width: 131, height: 72 });
    expect(nodeSize({ shape: 'circle', label: 'A' })).toEqual({ width: 81, height: 81 });
    expect(nodeSize({ shape: 'tri', label: 'A' })).toEqual({ width: 144, height: 75 });
    expect(nodeSize({ shape: 'cloud', label: 'A' })).toEqual({ width: 130, height: 72 });
    expect(nodeSize({ shape: 'person', label: 'A' })).toEqual({ width: 90, height: 78 });
    expect(nodeSize({ shape: 'hex', label: 'A' })).toEqual({ width: 118, height: 44 });
    expect(nodeSize({ shape: 'cyl', label: 'A' })).toEqual({ width: 90, height: 60 });
    expect(nodeSize({ shape: 'doc', label: 'A' })).toEqual({ width: 90, height: 56 });
    expect(nodeSize({ shape: 'docs', label: 'A' })).toEqual({ width: 98, height: 58 });
    expect(nodeSize({ shape: 'folder', label: 'A' })).toEqual({ width: 90, height: 58 });
    expect(nodeSize({ shape: 'brace', label: 'A' })).toEqual({ width: 100, height: 44 });
  });

  it('gives fixed shapes their fixed size', () => {
    expect(nodeSize({ shape: 'fork', label: 'ignored' })).toEqual({ width: 90, height: 12 });
    expect(NO_LABEL.has('fork')).toBe(true);
  });

  it('sizes icon and image nodes from their asset', () => {
    expect(nodeSize({ shape: 'rect', label: '', icon: 'mdi:x' })).toEqual({
      width: 48,
      height: 48,
    });
    expect(nodeSize({ shape: 'rect', label: 'Database server', icon: 'mdi:x', h: 30 })).toEqual({
      width: 119,
      height: 54,
    });
    expect(nodeSize({ shape: 'rect', label: '', img: 'u', w: 120, h: 0 })).toEqual({
      width: 120,
      height: 48,
    });
  });
});
