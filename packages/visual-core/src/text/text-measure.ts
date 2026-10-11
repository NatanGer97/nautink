const APPROX_CHAR_WIDTH: number = 7;
const DEFAULT_CACHE_LIMIT: number = 5000;

/** Width in pixels of `text` drawn in a CSS `font`. The web app passes a canvas-backed one. */
export type TextMeasurer = (text: string, font: string) => number;

/** The DOM-free fallback v1 used when no canvas was available: 7px per character. */
export function approximateTextWidth(text: string): number {
  return text.length * APPROX_CHAR_WIDTH;
}

/** Wraps a measurer with a cache that is cleared once it holds `limit` entries. */
export function createCachedMeasurer(
  measure: TextMeasurer,
  limit: number = DEFAULT_CACHE_LIMIT,
): TextMeasurer {
  const cache: Map<string, number> = new Map<string, number>();
  return (text: string, font: string): number => {
    const key: string = `${font}\u0000${text}`;
    const hit: number | undefined = cache.get(key);
    if (hit !== undefined) {
      return hit;
    }
    if (cache.size > limit) {
      cache.clear();
    }
    const width: number = measure(text, font);
    cache.set(key, width);
    return width;
  };
}
