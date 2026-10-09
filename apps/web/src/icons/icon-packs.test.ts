import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadIconPack, mermaidIconLoaders } from './icon-packs.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Partial<Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => Promise.resolve({ ok: true, status: 200, ...response }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('loadIconPack', () => {
  it('fetches a pack once, and resolves aliases onto it', async () => {
    const pack = { prefix: 'fa6-solid', icons: { house: { body: '<path/>' } } };
    const fetchMock = stubFetch({ json: async () => Promise.resolve(pack) });
    await expect(loadIconPack('fa')).resolves.toEqual(pack);
    await expect(loadIconPack('fa6-solid')).resolves.toEqual(pack);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws for an unknown prefix, a failed fetch and a file that is not a pack', async () => {
    await expect(loadIconPack('nope')).rejects.toThrow('Unknown icon pack "nope"');
    stubFetch({ ok: false, status: 404 });
    await expect(loadIconPack('carbon')).rejects.toThrow('HTTP 404');
    stubFetch({ json: async () => Promise.resolve({ icons: 3 }) });
    await expect(loadIconPack('carbon')).rejects.toThrow('not an Iconify JSON pack');
    stubFetch({ json: async () => Promise.resolve(null) });
    await expect(loadIconPack('carbon')).rejects.toThrow('not an Iconify JSON pack');
  });
});

describe('mermaidIconLoaders', () => {
  it('has one loader per prefix and alias, each loading its pack', async () => {
    const pack = { prefix: 'mdi', icons: {} };
    stubFetch({ json: async () => Promise.resolve(pack) });
    const loaders = mermaidIconLoaders();
    expect(loaders.map((loader) => loader.name)).toEqual([
      'mdi',
      'logos',
      'fa6-solid',
      'fa6-brands',
      'carbon',
      'fa',
      'fas',
      'fab',
    ]);
    await expect(loaders[0]!.loader()).resolves.toEqual(pack);
  });
});
