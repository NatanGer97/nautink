import { approximateTextWidth, createCachedMeasurer } from '@nautink/visual-core/text-measure';

import type { TextMeasurer } from '@nautink/visual-core/text-measure';

let context: CanvasRenderingContext2D | null | undefined;

/** One shared 2D context; null where there is no canvas (tests in jsdom). */
function measuringContext(): CanvasRenderingContext2D | null {
  if (context === undefined) {
    try {
      context = document.createElement('canvas').getContext('2d');
    } catch {
      context = null;
    }
  }
  return context;
}

/** Width of `text` in CSS `font`, from a canvas; v1's 7 px per character where there is none. */
export function measureText(text: string, font: string): number {
  const canvas: CanvasRenderingContext2D | null = measuringContext();
  if (canvas === null) {
    return approximateTextWidth(text);
  }
  canvas.font = font;
  return canvas.measureText(text).width;
}

/**
 * The text measurer editors pass to `@nautink/editors` layouts and sizes (class, ER, sequence),
 * cached, so laying out a large diagram measures each label once.
 */
export const canvasTextMeasurer: TextMeasurer = createCachedMeasurer(measureText);
