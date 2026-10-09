import { describe, expect, it } from 'vitest';

import {
  clampZoom,
  fitView,
  IDENTITY_VIEW,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  viewTransformCss,
  wheelZoomFactor,
  zoomAt,
  zoomLabel,
} from './view-math.ts';

describe('fitView', () => {
  it('centers the content as large as fits, with padding', () => {
    const view = fitView({ width: 400, height: 200 }, { width: 848, height: 848 });
    expect(view.k).toBe(2);
    expect(view.x).toBe(24);
    expect(view.y).toBe(224);
  });

  it('shrinks large content and never enlarges past 200 %', () => {
    expect(fitView({ width: 2048, height: 100 }, { width: 1072, height: 600 }).k).toBe(0.5);
    expect(fitView({ width: 10, height: 10 }, { width: 1000, height: 1000 }).k).toBe(2);
  });

  it('returns the identity view when either side has no size', () => {
    expect(fitView({ width: 0, height: 10 }, { width: 100, height: 100 })).toEqual(IDENTITY_VIEW);
    expect(fitView({ width: 10, height: 10 }, { width: 0, height: 0 })).toEqual(IDENTITY_VIEW);
  });
});

describe('zoomAt', () => {
  it('keeps the point under the cursor still', () => {
    const view = zoomAt({ x: 10, y: 20, k: 1 }, 2, { x: 110, y: 120 });
    expect(view).toEqual({ k: 2, x: -90, y: -80 });
  });

  it('clamps to the zoom limits', () => {
    expect(zoomAt({ x: 0, y: 0, k: 7 }, 10, { x: 0, y: 0 }).k).toBe(MAX_ZOOM);
    expect(zoomAt({ x: 0, y: 0, k: 0.2 }, 0.01, { x: 0, y: 0 }).k).toBe(MIN_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
  });
});

describe('helpers', () => {
  it('pans, zooms by wheel, labels and builds the CSS transform', () => {
    expect(panBy({ x: 1, y: 2, k: 3 }, 10, -5)).toEqual({ x: 11, y: -3, k: 3 });
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
    expect(wheelZoomFactor(0)).toBe(1);
    expect(zoomLabel(1.071)).toBe('107%');
    expect(viewTransformCss({ x: 5, y: 6, k: 2 })).toBe('translate(5px, 6px) scale(2)');
  });
});
