import { initMermaid, loadMermaid } from './mermaid-instance.ts';
import { enqueueMermaid } from './mermaid-queue.ts';

import type { Mermaid } from 'mermaid';

/** A rendered thumbnail, or why there is none. */
export type Thumbnail = { kind: 'image'; url: string } | { kind: 'error'; message: string };

/** Rendered thumbnails kept per theme and code (v1 kept 300). */
const CACHE_LIMIT: number = 300;
const cache: Map<string, Promise<Thumbnail>> = new Map<string, Promise<Thumbnail>>();
let renders: number = 0;

/** An SVG as a data URL, sized to its view box so it scales inside an `<img>`. */
export function svgToDataUrl(svg: string): string {
  const root: Element = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const box: number[] = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const [, , width, height] = box;
  if (width !== undefined && height !== undefined && width > 0) {
    root.setAttribute('width', String(width));
    root.setAttribute('height', String(height));
    root.setAttribute('style', 'max-width: none');
  }
  const text: string = new XMLSerializer().serializeToString(root);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
}

async function renderNow(code: string, isDark: boolean): Promise<Thumbnail> {
  renders += 1;
  const id: string = `nautink-thumb-${String(renders)}`;
  try {
    const mermaid: Mermaid = await loadMermaid();
    await initMermaid(isDark);
    await mermaid.parse(code);
    const { svg } = await mermaid.render(id, code);
    return { kind: 'image', url: svgToDataUrl(svg) };
  } catch {
    // Mermaid leaves its scratch element behind when a render fails.
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
    return { kind: 'error', message: 'Does not render' };
  }
}

/** Renders `code` small, through the shared Mermaid queue, once per theme and code. */
export async function renderThumbnail(code: string, isDark: boolean): Promise<Thumbnail> {
  if (code.trim() === '') {
    return { kind: 'error', message: 'Empty' };
  }
  const key: string = `${isDark ? 'dark' : 'light'}\n${code}`;
  const cached: Promise<Thumbnail> | undefined = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const [oldest] = cache.keys();
  if (cache.size >= CACHE_LIMIT && oldest !== undefined) {
    cache.delete(oldest);
  }
  const rendered: Promise<Thumbnail> = enqueueMermaid(async () => renderNow(code, isDark));
  cache.set(key, rendered);
  return rendered;
}
