import { describe, expect, it } from 'vitest';

import {
  findIcon,
  iconPackPrefixes,
  resolvePackPrefix,
  searchIconNames,
  splitIconName,
} from './icons.ts';

const pack = {
  width: 32,
  icons: {
    database: { body: '<path d="db"/>' },
    'database-off': { body: '<path/>', width: 24, height: 20 },
    'data-base': { body: '<g/>' },
  },
  aliases: { db: { parent: 'database' }, 'db-alias': { parent: 'db' }, broken: { parent: 'nope' } },
};

describe('pack prefixes', () => {
  it('lists bundled packs and aliases', () => {
    expect(iconPackPrefixes()).toEqual([
      'mdi',
      'logos',
      'fa6-solid',
      'fa6-brands',
      'carbon',
      'fa',
      'fas',
      'fab',
    ]);
  });

  it('resolves aliases and throws on unknown packs', () => {
    expect(resolvePackPrefix('fab')).toBe('fa6-brands');
    expect(resolvePackPrefix('mdi')).toBe('mdi');
    expect(() => resolvePackPrefix('nope')).toThrow('Unknown icon pack "nope"');
  });
});

describe('splitIconName', () => {
  it('splits prefix and name', () => {
    expect(splitIconName('mdi:database')).toEqual({ prefix: 'mdi', name: 'database' });
  });

  it('throws on a name without a prefix', () => {
    expect(() => splitIconName('database')).toThrow('Invalid icon name "database"');
    expect(() => splitIconName(':x')).toThrow();
  });
});

describe('findIcon', () => {
  it('finds an icon with the pack default size', () => {
    expect(findIcon(pack, 'database')).toEqual({ body: '<path d="db"/>', width: 32, height: 24 });
    expect(findIcon(pack, 'database-off')).toEqual({ body: '<path/>', width: 24, height: 20 });
  });

  it('follows aliases', () => {
    expect(findIcon(pack, 'db-alias')?.body).toBe('<path d="db"/>');
  });

  it('returns null for unknown names and broken aliases', () => {
    expect(findIcon(pack, 'missing')).toBeNull();
    expect(findIcon(pack, 'broken')).toBeNull();
  });

  it('stops after five alias hops', () => {
    const loop = { icons: {}, aliases: { a: { parent: 'b' }, b: { parent: 'a' } } };
    expect(findIcon(loop, 'a')).toBeNull();
  });
});

describe('searchIconNames', () => {
  it('puts prefix matches first, shorter first', () => {
    expect(searchIconNames({ pack, prefix: 'mdi', query: ' Data' })).toEqual([
      'mdi:database',
      'mdi:data-base',
      'mdi:database-off',
    ]);
    expect(searchIconNames({ pack, prefix: 'x', query: 'base' })).toEqual([
      'x:database',
      'x:data-base',
      'x:database-off',
    ]);
  });

  it('lists everything for an empty query, up to the limit', () => {
    expect(searchIconNames({ pack, prefix: 'mdi', query: '', limit: 2 })).toHaveLength(2);
  });
});
