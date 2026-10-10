import type { Mermaid } from 'mermaid';

let instance: Promise<Mermaid> | null = null;

/** Mermaid is large, so it loads on first use and is shared by everything after that. */
export async function loadMermaid(): Promise<Mermaid> {
  instance ??= (async (): Promise<Mermaid> => (await import('mermaid')).default)();
  return instance;
}

/**
 * Mermaid's `base` theme in the brand colors (docs/brand/): teal-washed shapes with a teal outline
 * and slate links. Mermaid derives every other color (clusters, notes, actors, ER rows) from these.
 * Literal colors, because Mermaid cannot read CSS variables; they match the PRD §6.1 tokens.
 */
const LIGHT_DIAGRAM: Readonly<Record<string, string | boolean>> = {
  darkMode: false,
  // Flat shapes, like the rest of the canvas (PRD §6.3): `base` adds a grey drop shadow.
  dropShadow: 'none',
  background: '#F4F7F9',
  primaryColor: '#E2F3F5',
  primaryBorderColor: '#3D9AA5',
  primaryTextColor: '#0E1F33',
  secondaryColor: '#EAF0F4',
  tertiaryColor: '#F9FBFC',
  lineColor: '#6B7C8D',
  textColor: '#0E1F33',
  noteBkgColor: '#FBF2DC',
  noteTextColor: '#0E1F33',
};

const DARK_DIAGRAM: Readonly<Record<string, string | boolean>> = {
  darkMode: true,
  dropShadow: 'none',
  background: '#0A1320',
  primaryColor: '#12303A',
  primaryBorderColor: '#2FB6C4',
  primaryTextColor: '#E8EEF6',
  secondaryColor: '#172638',
  tertiaryColor: '#122032',
  lineColor: '#7F92A6',
  textColor: '#E8EEF6',
  noteBkgColor: '#2B2716',
  noteTextColor: '#E8EEF6',
};

/**
 * v1's settings: strict security, and plain SVG text (no `<foreignObject>`) so PNG export does not
 * taint the canvas. Call again when the theme changes.
 */
export async function initMermaid(isDark: boolean): Promise<void> {
  const mermaid: Mermaid = await loadMermaid();
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: isDark ? DARK_DIAGRAM : LIGHT_DIAGRAM,
    securityLevel: 'strict',
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
  });
}
