const DECIMALS: number = 100;

/**
 * SVG path data with numbers in the holes: svg`M${x},${y} H${x + w}`. The numbers are rounded to
 * two decimals, so paths stay short and stable in tests.
 */
export function svg(strings: TemplateStringsArray, ...values: readonly number[]): string {
  return strings.reduce(
    (path: string, part: string, index: number) =>
      index === 0
        ? part
        : `${path}${String(Math.round((values[index - 1] ?? 0) * DECIMALS) / DECIMALS)}${part}`,
    '',
  );
}

/** A `translate(x y)` transform. */
export function translate(x: number, y: number): string {
  return svg`translate(${x} ${y})`;
}
