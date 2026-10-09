import { useCallback, useSyncExternalStore } from 'react';

/** Whether a CSS media query matches, kept in sync as the window changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe: (onChange: () => void) => () => void = useCallback(
    (onChange: () => void): (() => void) => {
      const list: MediaQueryList = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** PRD §5: under 1024 px the panels and the code drawer become overlays. */
export const NARROW_QUERY: string = '(max-width: 1023.98px)';
