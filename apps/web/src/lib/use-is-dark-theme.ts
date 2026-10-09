import { DARK_QUERY, resolveTheme } from '@nautink/ui/theme';

import { useMediaQuery } from './use-media-query.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { ThemePreference } from '@nautink/ui/theme';

/** True while the app paints its dark theme (the setting, or the OS when it is `system`). */
export function useIsDarkTheme(): boolean {
  const preference: ThemePreference = useUiStore((state) => state.themePreference);
  const isSystemDark: boolean = useMediaQuery(DARK_QUERY);
  return resolveTheme(preference, isSystemDark) === 'dark';
}
