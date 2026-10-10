import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import { DARK_CODE_FILL_SHARE, DARK_CODE_NODE_FILL, DARK_CODE_SVG_FILL } from './code-colors.ts';

const WCAG_TEXT: number = 4.5;

/** The shared stylesheet itself (Vitest empties CSS imports, so it is read from disk). */
const globals: string = readFileSync(
  createRequire(import.meta.url).resolve('@nautink/ui/globals.css'),
  'utf8',
);

/** A token's hex value in the dark theme, read from the shared stylesheet. */
function darkToken(name: string): string {
  const dark: string = globals.slice(globals.indexOf('.dark {'));
  const match: RegExpExecArray | null = new RegExp(`--${name}: (#[0-9a-f]{6});`).exec(dark);
  if (match?.[1] === undefined) {
    throw new Error(`No dark --${name} token`);
  }
  return match[1];
}

function channels(hex: string): number[] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

function luminance(rgb: readonly number[]): number {
  const [red = 0, green = 0, blue = 0] = rgb.map((value) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(text: readonly number[], fill: readonly number[]): number {
  const [light, dark] = [luminance(text), luminance(fill)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

/** `color` at `share` over `base`, as `fill-opacity` and `color-mix` draw it. */
function blend(color: readonly number[], base: readonly number[], share: number): number[] {
  return color.map((value, index) => value * share + (base[index] ?? 0) * (1 - share));
}

describe('code-given fills in dark mode', () => {
  it.each(['panel', 'background'])(
    'keep labels at 4.5:1 or more even for a white fill over the %s',
    (base) => {
      const fill = blend([255, 255, 255], channels(darkToken(base)), DARK_CODE_FILL_SHARE);
      for (const text of ['foreground', 'muted-foreground']) {
        expect(contrast(channels(darkToken(text)), fill)).toBeGreaterThanOrEqual(WCAG_TEXT);
      }
    },
  );

  it('use the same share in both class strings', () => {
    expect(DARK_CODE_SVG_FILL).toContain(`fill-opacity:${String(DARK_CODE_FILL_SHARE)}`);
    expect(DARK_CODE_NODE_FILL).toContain(`_${String(DARK_CODE_FILL_SHARE * 100)}%`);
  });
});
