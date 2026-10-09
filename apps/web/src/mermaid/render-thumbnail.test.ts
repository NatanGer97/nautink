import { describe, expect, it, vi } from 'vitest';

import { renderThumbnail, svgToDataUrl } from './render-thumbnail.ts';

describe('svgToDataUrl', () => {
  it('sizes the picture to its view box so it scales in an img', () => {
    const url = svgToDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" style="max-width: 120px"></svg>',
    );
    const svg = decodeURIComponent(url.replace('data:image/svg+xml;charset=utf-8,', ''));
    expect(svg).toContain('width="120"');
    expect(svg).toContain('height="40"');
    expect(svg).toContain('max-width: none');
  });

  it('leaves a picture without a view box as it is', () => {
    const url = svgToDataUrl('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(decodeURIComponent(url)).not.toContain('width=');
  });
});

describe('renderThumbnail', () => {
  it('says why there is no picture for empty or broken code', async () => {
    expect(await renderThumbnail('  ', false)).toEqual({ kind: 'error', message: 'Empty' });
    expect(await renderThumbnail('flowchart TD\n  A -->', false)).toEqual({
      kind: 'error',
      message: 'Does not render',
    });
  });

  it('renders each code and theme once', async () => {
    const mermaid = (await import('mermaid')).default;
    const render = vi.spyOn(mermaid, 'render').mockResolvedValue({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      diagramType: 'flowchart',
    });
    const first = await renderThumbnail('flowchart TD\n  A --> B', true);
    const second = await renderThumbnail('flowchart TD\n  A --> B', true);
    expect(first.kind).toBe('image');
    expect(second).toBe(first);
    expect(render).toHaveBeenCalledTimes(1);
    render.mockRestore();
  });
});
