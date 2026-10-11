const DEFAULT_ICON_SIZE: number = 24;
const DEFAULT_SEARCH_LIMIT: number = 120;
const MAX_ALIAS_DEPTH: number = 5;

/** An Iconify pack bundled with the app. The web app loads the pack JSON on demand. */
export interface IconPackInfo {
  prefix: string;
  name: string;
}

export const ICON_PACKS: readonly IconPackInfo[] = [
  { prefix: 'mdi', name: 'Material Design' },
  { prefix: 'logos', name: 'Tech logos' },
  { prefix: 'fa6-solid', name: 'Font Awesome' },
  { prefix: 'fa6-brands', name: 'Font Awesome brands' },
  { prefix: 'carbon', name: 'Carbon' },
];

/** Prefixes people (and LLMs) commonly write, mapped onto bundled packs. */
export const PREFIX_ALIASES: Readonly<Record<string, string>> = {
  fa: 'fa6-solid',
  fas: 'fa6-solid',
  fab: 'fa6-brands',
};

/** The subset of an Iconify JSON pack that icon lookup reads. */
export interface IconifyPack {
  icons: Record<string, { body: string; width?: number; height?: number }>;
  aliases?: Record<string, { parent: string }>;
  width?: number;
  height?: number;
}

/** An icon's SVG body (not yet sanitized) and its view box size. */
export interface IconData {
  body: string;
  width: number;
  height: number;
}

/** Every prefix Mermaid's icon loader should register, aliases included. */
export function iconPackPrefixes(): string[] {
  return [...ICON_PACKS.map((pack: IconPackInfo) => pack.prefix), ...Object.keys(PREFIX_ALIASES)];
}

/** The bundled pack a prefix (or alias) names. Throws for an unknown prefix. */
export function resolvePackPrefix(prefix: string): string {
  const real: string = PREFIX_ALIASES[prefix] ?? prefix;
  if (!ICON_PACKS.some((pack: IconPackInfo) => pack.prefix === real)) {
    throw new Error(`Unknown icon pack "${prefix}"`);
  }
  return real;
}

/** Splits "mdi:database" into its prefix and name. Throws when either part is missing. */
export function splitIconName(fullName: string): { prefix: string; name: string } {
  const [prefix = '', name = ''] = fullName.split(':');
  if (!prefix || !name) {
    throw new Error(`Invalid icon name "${fullName}": expected "prefix:name"`);
  }
  return { prefix, name };
}

/** Looks an icon up in a pack, following aliases. Null when the pack has no such icon. */
export function findIcon(pack: IconifyPack, name: string): IconData | null {
  let key: string = name;
  for (let depth: number = 0; depth <= MAX_ALIAS_DEPTH; depth++) {
    const icon: IconifyPack['icons'][string] | undefined = pack.icons[key];
    if (icon) {
      return {
        body: icon.body,
        width: icon.width ?? pack.width ?? DEFAULT_ICON_SIZE,
        height: icon.height ?? pack.height ?? DEFAULT_ICON_SIZE,
      };
    }
    const parent: string | undefined = pack.aliases?.[key]?.parent;
    if (parent === undefined) {
      return null;
    }
    key = parent;
  }
  return null;
}

export interface IconSearch {
  pack: IconifyPack;
  prefix: string;
  query: string;
  limit?: number;
}

function byPrefixThenLength(query: string): (a: string, b: string) => number {
  return (a: string, b: string): number => {
    const isPrefixA: boolean = a.startsWith(query);
    if (isPrefixA === b.startsWith(query)) {
      return a.length - b.length;
    }
    return isPrefixA ? -1 : 1;
  };
}

/** Icon names in one pack that contain `query`, prefix matches first. Returns "prefix:name". */
export function searchIconNames({
  pack,
  prefix,
  query,
  limit = DEFAULT_SEARCH_LIMIT,
}: IconSearch): string[] {
  const needle: string = query.trim().toLowerCase();
  const names: string[] = Object.keys(pack.icons);
  const hits: string[] = needle ? names.filter((name: string) => name.includes(needle)) : names;
  return hits
    .sort(byPrefixThenLength(needle))
    .slice(0, limit)
    .map((name: string) => `${prefix}:${name}`);
}
