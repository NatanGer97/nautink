import { describe, expect, it } from 'vitest';

import { selfLoop, transitionCurve } from './transition-edge.tsx';

describe('transition edge geometry', () => {
  it('curves out of the source side and into the target side, label at the middle', () => {
    const curve = transitionCurve({
      source: { x: 0, y: 0, side: 'bottom' },
      target: { x: 0, y: 100, side: 'top' },
      offset: 0,
      isFlipped: false,
    });
    expect(curve.path).toBe('M0,0 C0,32 0,68 0,100');
    expect(curve).toMatchObject({ labelX: 0, labelY: 50 });
  });

  it('bends parallels apart, and A→B and B→A to opposite sides', () => {
    const request = {
      source: { x: 0, y: 0, side: 'right' },
      target: { x: 100, y: 0, side: 'left' },
      offset: 0.5,
    };
    const forward = transitionCurve({ ...request, isFlipped: false });
    const back = transitionCurve({ ...request, isFlipped: true });
    expect(forward.labelY).toBeGreaterThan(0);
    expect(back.labelY).toBeLessThan(0);
    const unknown = transitionCurve({
      ...request,
      source: { x: 0, y: 0, side: 'x' },
      isFlipped: false,
    });
    expect(unknown.path.startsWith('M0,0')).toBe(true);
  });

  it('loops over a state’s top-right corner, further out for each extra loop', () => {
    const box = { x: 0, y: 0, w: 100, h: 40 };
    expect(selfLoop(box, 0).path).toBe('M100,20 C146,20 82,-46 82,0');
    expect(selfLoop(box, 1).labelX).toBeGreaterThan(selfLoop(box, 0).labelX);
  });
});
