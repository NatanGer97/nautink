// Colors that diagram code gives its shapes (`rect rgb(…)` blocks, class `style` / `classDef`) are
// usually picked for a light page. In dark mode the canvas keeps only a little of such a fill and
// lets the dark panel show through, so the app's light text stays readable (≥ 4.5:1) on any color.
// Light mode draws the code's colors as they are.

/** The share of a code-given fill kept in dark mode. */
export const DARK_CODE_FILL_SHARE: number = 0.12;

/** On an SVG shape filled from code: in dark mode, only `DARK_CODE_FILL_SHARE` of its fill shows. */
export const DARK_CODE_SVG_FILL: string = 'dark:[fill-opacity:0.12]';

/**
 * On an HTML node whose `--node-fill` comes from code: in dark mode its background is the code's
 * color mixed into the panel, and its text is the app's own (a code text color was picked for the
 * full-strength fill, so it is dropped).
 */
export const DARK_CODE_NODE_FILL: string =
  'dark:bg-[color-mix(in_srgb,var(--node-fill)_12%,var(--panel))] dark:text-foreground!';
