import carbonUrl from '@iconify-json/carbon/icons.json?url';
import faBrandsUrl from '@iconify-json/fa6-brands/icons.json?url';
import faSolidUrl from '@iconify-json/fa6-solid/icons.json?url';
import logosUrl from '@iconify-json/logos/icons.json?url';
import mdiUrl from '@iconify-json/mdi/icons.json?url';
import { iconPackPrefixes, resolvePackPrefix } from '@nautink/visual-core/icons';

import type { AsyncIconLoader } from 'mermaid';

/** An Iconify JSON pack, as Mermaid's icon loader wants it. */
export type IconPackJson = Awaited<ReturnType<AsyncIconLoader['loader']>>;

/**
 * Where each bundled pack's JSON is served. Only the URL is in the app bundle; the multi-megabyte
 * JSON is fetched the first time a diagram uses one of its icons (PRD §9).
 */
const PACK_URLS: Readonly<Record<string, string>> = {
  mdi: mdiUrl,
  logos: logosUrl,
  'fa6-solid': faSolidUrl,
  'fa6-brands': faBrandsUrl,
  carbon: carbonUrl,
};

const cache: Map<string, Promise<IconPackJson>> = new Map<string, Promise<IconPackJson>>();

function isIconPackJson(value: unknown): value is IconPackJson {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const pack: { prefix?: unknown; icons?: unknown } = value;
  return typeof pack.prefix === 'string' && typeof pack.icons === 'object' && pack.icons !== null;
}

async function fetchPack(prefix: string, url: string): Promise<IconPackJson> {
  const response: Response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load the icon pack "${prefix}" (HTTP ${String(response.status)}).`);
  }
  const json: unknown = await response.json();
  if (!isIconPackJson(json)) {
    throw new Error(`The icon pack "${prefix}" is not an Iconify JSON pack.`);
  }
  return json;
}

/** Fetches a pack, and forgets a failed fetch so the next diagram that needs it tries again. */
async function fetchPackOnce(prefix: string, url: string): Promise<IconPackJson> {
  try {
    return await fetchPack(prefix, url);
  } catch (err) {
    cache.delete(prefix);
    throw err;
  }
}

/** The pack a prefix (or an alias such as `fa`) names, fetched once. Throws for an unknown prefix. */
export async function loadIconPack(prefix: string): Promise<IconPackJson> {
  const real: string = resolvePackPrefix(prefix);
  const url: string | undefined = PACK_URLS[real];
  if (url === undefined) {
    throw new Error(`The icon pack "${real}" has no bundled JSON.`);
  }
  let pack: Promise<IconPackJson> | undefined = cache.get(real);
  if (pack === undefined) {
    pack = fetchPackOnce(real, url);
    cache.set(real, pack);
  }
  return pack;
}

/** Mermaid's icon loaders: one per prefix, aliases included, each loading its pack on first use. */
export function mermaidIconLoaders(): AsyncIconLoader[] {
  return iconPackPrefixes().map((name: string) => ({
    name,
    loader: async (): Promise<IconPackJson> => loadIconPack(name),
  }));
}
