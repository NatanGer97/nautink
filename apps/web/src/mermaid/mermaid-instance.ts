import type { Mermaid } from 'mermaid';

let instance: Promise<Mermaid> | null = null;

/** Mermaid is large, so it loads on first use and is shared by everything after that. */
export async function loadMermaid(): Promise<Mermaid> {
  instance ??= (async (): Promise<Mermaid> => (await import('mermaid')).default)();
  return instance;
}

/**
 * v1's settings: strict security, and plain SVG text (no `<foreignObject>`) so PNG export does not
 * taint the canvas. Call again when the theme changes.
 */
export async function initMermaid(isDark: boolean): Promise<void> {
  const mermaid: Mermaid = await loadMermaid();
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'strict',
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
  });
}
