import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pngSize, standaloneSvg, svgToPng } from './svg-to-png.ts';

// jsdom has no image decoding; the browser's `decode` is stood in for per test.
const decode = vi.fn<() => Promise<void>>();

beforeEach(() => {
  HTMLImageElement.prototype.decode = decode;
  decode.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pngSize', () => {
  it('scales and rounds, and rejects scales outside 1–4', () => {
    expect(pngSize({ width: 100.4, height: 50 }, 3)).toEqual({ width: 301, height: 150 });
    expect(() => pngSize({ width: 1, height: 1 }, 0.5)).toThrow('between 1 and 4, got 0.5');
    expect(() => pngSize({ width: 1, height: 1 }, 5)).toThrow('got 5');
    expect(() => pngSize({ width: 1, height: 1 }, Number.NaN)).toThrow('got NaN');
  });
});

describe('standaloneSvg', () => {
  it('gives the SVG its view box size and drops the inline max-width', () => {
    const { markup, size } = standaloneSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60" style="max-width: 120px"></svg>',
    );
    expect(size).toEqual({ width: 120, height: 60 });
    expect(markup).toContain('width="120"');
    expect(markup).not.toContain('style=');
  });

  it('falls back to 800 × 600 without a view box', () => {
    expect(standaloneSvg('<svg xmlns="http://www.w3.org/2000/svg"></svg>').size).toEqual({
      width: 800,
      height: 600,
    });
  });
});

describe('svgToPng', () => {
  it('reports an SVG the browser cannot load', async () => {
    decode.mockRejectedValue(new Error('bad'));
    await expect(
      svgToPng('<svg xmlns="http://www.w3.org/2000/svg"/>', { scale: 1, background: null }),
    ).rejects.toThrow('Could not load the diagram for PNG export.');
  });

  it('draws the diagram over the background and encodes a PNG', async () => {
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['png'], { type: 'image/png' }));
    });
    const blob = await svgToPng('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"/>', {
      scale: 2,
      background: '#FFFFFF',
    });
    expect(blob.type).toBe('image/png');
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 20, 40);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 20, 40);
  });

  it('fails clearly without a 2D context or when encoding fails', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"/>';
    await expect(svgToPng(svg, { scale: 1, background: null })).rejects.toThrow(
      'cannot draw a PNG',
    );
    getContext.mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(null);
    });
    await expect(svgToPng(svg, { scale: 1, background: null })).rejects.toThrow(
      'PNG export failed.',
    );
  });
});
