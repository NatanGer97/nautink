// A tiny path language for shape outlines: SVG path data with `{…}` holes, each a sum of terms
// such as `w-1`, `0.75w` or `hh+6`. Shapes are then plain data (see `shape-geometry.ts`), and the
// numbers live in the templates instead of in code.

/** The variables a template can use: `w`, `h` and whatever a shape derives from them. */
export type TemplateVars = Readonly<Record<string, number>>;

const TERM: RegExp = /([+-]?)(\d*\.?\d+)?([a-z]*)/y;
const HOLE: RegExp = /\{([^}]+)\}/g;
const DECIMALS: number = 100;

function termValue(match: RegExpExecArray, vars: TemplateVars, expression: string): number {
  const [, sign = '', coefficient, name = ''] = match;
  const factor: number = coefficient === undefined ? 1 : Number(coefficient);
  const variable: number | undefined = name === '' ? 1 : vars[name];
  if (variable === undefined) {
    throw new Error(`Unknown variable "${name}" in the shape template "${expression}"`);
  }
  return (sign === '-' ? -1 : 1) * factor * variable;
}

/** The value of one hole, e.g. `w-s-1` with w = 100 and s = 10 → 89. Throws on anything else. */
export function evaluate(expression: string, vars: TemplateVars): number {
  let total: number = 0;
  let index: number = 0;
  while (index < expression.length) {
    TERM.lastIndex = index;
    const match: RegExpExecArray | null = TERM.exec(expression);
    if (match === null || match[0] === '' || (match[2] === undefined && match[3] === '')) {
      throw new Error(`Cannot read the shape template "${expression}" at ${String(index)}`);
    }
    total += termValue(match, vars, expression);
    index = TERM.lastIndex;
  }
  return total;
}

/** Fills every hole in `template`, rounded to two decimals. */
export function fillTemplate(template: string, vars: TemplateVars): string {
  return template.replace(HOLE, (...match: string[]) =>
    String(Math.round(evaluate(match[1] ?? '', vars) * DECIMALS) / DECIMALS),
  );
}
