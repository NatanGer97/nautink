import { Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { selfLoop, shiftEnd } from './er-edge.tsx';

describe('relationship paths', () => {
  it('slides an end along its side', () => {
    expect(shiftEnd({ x: 10, y: 20 }, Position.Left, 5)).toEqual({ x: 10, y: 25 });
    expect(shiftEnd({ x: 10, y: 20 }, Position.Top, -5)).toEqual({ x: 5, y: 20 });
    expect(shiftEnd({ x: 10, y: 20 }, Position.Bottom, 0)).toEqual({ x: 10, y: 20 });
  });

  it('loops an entity to itself round its top-right corner', () => {
    const [path, labelX, labelY] = selfLoop({ x: 200, y: 50 }, { x: 100, y: 0 });
    expect(path.startsWith('M200,50 L226,50 Q234,50 234,42')).toBe(true);
    expect(path.endsWith(' L100,0')).toBe(true);
    expect([labelX, labelY]).toEqual([167, -34]);
  });
});
