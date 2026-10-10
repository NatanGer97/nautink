// Live build (PRD §4.3, §6.4): while Claude's reply streams into a diagram, each shape that was
// not on the canvas before fades in, in under 150 ms. Works on Mermaid's render and on the
// visual editors alike, by watching the DOM for shapes with a new id. Motion loads when a reply
// starts streaming, not with the app, so it stays out of the main bundle (PRD §9).
import { useEffect } from 'react';

import { idsOf } from '../preview/locate.ts';

import type { animate } from 'motion/mini';
import type { RefObject } from 'react';

type Animate = typeof animate;

let motionLoad: Promise<Animate> | null = null;

async function importAnimate(): Promise<Animate> {
  return (await import('motion/mini')).animate;
}

/** Motion's `animate`, imported once, on first use. */
async function loadAnimate(): Promise<Animate> {
  motionLoad ??= importAnimate();
  return motionLoad;
}

/** PRD §6.4: 120–180 ms ease-out, and §4.3: under 150 ms. */
export const FADE_SECONDS: number = 0.12;

/** Mermaid's nodes, clusters and links, React Flow's nodes and edges, the sequence editor's rows. */
const SHAPE_SELECTOR: string = 'g.node, g.cluster, [data-id], [data-testid^="sequence-"]';

/** What identifies a shape across renders: its diagram id, React Flow id or test id. */
export function shapeKey(element: Element): string | null {
  return (
    element.getAttribute('data-id') ??
    element.getAttribute('data-testid') ??
    idsOf(element)[0] ??
    null
  );
}

function shapeKeys(root: Element): Map<string, Element> {
  const shapes: Map<string, Element> = new Map<string, Element>();
  for (const element of root.querySelectorAll(SHAPE_SELECTOR)) {
    const key: string | null = shapeKey(element);
    if (key !== null && !shapes.has(key)) {
      shapes.set(key, element);
    }
  }
  return shapes;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Fades `elements` in (none: only loads Motion). The fade is decoration: if Motion's chunk fails
 * to load, the shapes simply show without it, and the next fade tries the import again.
 */
async function fadeIn(elements: readonly Element[]): Promise<void> {
  try {
    const animateElement: Animate = await loadAnimate();
    for (const element of elements) {
      animateElement(element, { opacity: [0, 1] }, { duration: FADE_SECONDS, ease: 'easeOut' });
    }
  } catch {
    motionLoad = null;
  }
}

/** Fades in the shapes of `root` whose key is not in `seen`. Returns the keys shown now. */
export function fadeInNewShapes(root: Element, seen: ReadonlySet<string>): Set<string> {
  const shapes: Map<string, Element> = shapeKeys(root);
  const added: Element[] = [...shapes].filter(([key]) => !seen.has(key)).map(([, shape]) => shape);
  if (added.length > 0 && !prefersReducedMotion()) {
    void fadeIn(added);
  }
  return new Set<string>(shapes.keys());
}

/** While `isLive`, fades in every shape that appears in `rootRef` (the shapes already there stay). */
export function useLiveFade(rootRef: RefObject<HTMLElement | null>, isLive: boolean): void {
  useEffect(() => {
    const root: HTMLElement | null = rootRef.current;
    if (root === null || !isLive) {
      return undefined;
    }
    // Start loading Motion now, so it is there by the time the first new shape appears.
    void fadeIn([]);
    let seen: Set<string> = new Set<string>(shapeKeys(root).keys());
    const observer: MutationObserver = new MutationObserver(() => {
      seen = fadeInNewShapes(root, seen);
    });
    observer.observe(root, { childList: true, subtree: true });
    return (): void => {
      observer.disconnect();
    };
  }, [rootRef, isLive]);
}
