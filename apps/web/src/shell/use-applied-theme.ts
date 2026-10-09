import { applyTheme, DARK_QUERY, resolveTheme } from '@nautink/ui/theme';
import { useEffect } from 'react';

import { useMediaQuery } from '../lib/use-media-query.ts';

import type { ResolvedTheme, ThemePreference } from '@nautink/ui/theme';

/** Paints the theme for `preference` on `<html>` and returns it; follows the OS for `system`. */
export function useAppliedTheme(preference: ThemePreference): ResolvedTheme {
  const isSystemDark: boolean = useMediaQuery(DARK_QUERY);
  const theme: ResolvedTheme = resolveTheme(preference, isSystemDark);
  useEffect(() => {
    applyTheme(document.documentElement, theme);
  }, [theme]);
  return theme;
}
