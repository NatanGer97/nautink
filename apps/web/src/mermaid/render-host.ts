const HOST_ID: string = 'nautink-mermaid-host';

/**
 * Where Mermaid draws a diagram before handing back its SVG. By default Mermaid adds its scratch
 * element to the end of `<body>`, where it makes the page taller for a moment: a scrollbar flashes
 * and the whole layout shifts on every render. A fixed element never changes the page size, and
 * `visibility: hidden` (not `display: none`) keeps the text measurable for layout.
 */
export function mermaidRenderHost(): HTMLElement {
  const existing: HTMLElement | null = document.getElementById(HOST_ID);
  if (existing !== null) {
    return existing;
  }
  const host: HTMLElement = document.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;top:0;left:0;width:100%;visibility:hidden;pointer-events:none;z-index:-1;';
  document.body.append(host);
  return host;
}
