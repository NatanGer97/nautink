import { useEffect, useState } from 'react';

import { searchIcons } from '../icons/icon-lookup.ts';

/** Typing pauses this long before the pack is searched (v1). */
export const ICON_SEARCH_DELAY_MS: number = 150;
const RESULT_LIMIT: number = 90;

/** Search results, or null while they load; `error` when the pack could not be fetched. */
export interface IconSearchState {
  results: readonly string[] | null;
  error: string | null;
}

interface Found {
  key: string;
  results: readonly string[];
  error: string | null;
}

async function findIcons(prefix: string, query: string): Promise<Omit<Found, 'key'>> {
  try {
    return { results: await searchIcons(prefix, query, RESULT_LIMIT), error: null };
  } catch (err) {
    return { results: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/** Icons in pack `prefix` matching `query`, searched a beat after typing stops. */
export function useIconSearch(prefix: string, query: string): IconSearchState {
  const key: string = `${prefix}\n${query}`;
  const [found, setFound] = useState<Found | null>(null);
  useEffect(() => {
    let isLive: boolean = true;
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      void (async (): Promise<void> => {
        const result: Omit<Found, 'key'> = await findIcons(prefix, query);
        if (isLive) {
          setFound({ key, ...result });
        }
      })();
    }, ICON_SEARCH_DELAY_MS);
    return (): void => {
      isLive = false;
      clearTimeout(timer);
    };
  }, [key, prefix, query]);
  return found?.key === key ? found : { results: null, error: null };
}
