import { findIcon, searchIconNames, splitIconName } from '@nautink/visual-core/icons';
import DOMPurify from 'dompurify';

import { loadIconPack } from '../../icons/icon-packs.ts';

import type { IconPackJson } from '../../icons/icon-packs.ts';
import type { IconData } from '@nautink/visual-core/icons';

const icons: Map<string, Promise<IconData | null>> = new Map<string, Promise<IconData | null>>();

/** Iconify bodies are third-party SVG: sanitized inside an <svg> root (DOMPurify drops bare fragments). */
export function sanitizeSvgBody(body: string): string {
  const dom: Node = DOMPurify.sanitize(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`, {
    USE_PROFILES: { svg: true, svgFilters: true },
    RETURN_DOM: true,
  });
  const root: Element | null = dom instanceof Element ? dom.querySelector('svg') : null;
  return root?.innerHTML ?? '';
}

async function lookUp(fullName: string): Promise<IconData | null> {
  const { prefix, name } = splitIconName(fullName);
  const pack: IconPackJson = await loadIconPack(prefix);
  const icon: IconData | null = findIcon(pack, name);
  return icon === null ? null : { ...icon, body: sanitizeSvgBody(icon.body) };
}

/**
 * "mdi:database" → its sanitized SVG body and size, loading the pack on first use. Null when the
 * pack has no such icon; throws for a name without a prefix or a pack the app does not bundle.
 */
export async function getIcon(fullName: string): Promise<IconData | null> {
  let icon: Promise<IconData | null> | undefined = icons.get(fullName);
  if (icon === undefined) {
    icon = lookUp(fullName);
    icons.set(fullName, icon);
  }
  return icon;
}

/** Icon names in one pack that contain `query` ("prefix:name"), prefix matches first. */
export async function searchIcons(prefix: string, query: string, limit: number): Promise<string[]> {
  return searchIconNames({ pack: await loadIconPack(prefix), prefix, query, limit });
}
