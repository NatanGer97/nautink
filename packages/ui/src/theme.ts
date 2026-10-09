/** What the user picked in Settings. `system` follows the operating system. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** The theme actually painted. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export const THEME_LABELS: Readonly<Record<ThemePreference, string>> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

/** The class on `<html>` that switches every token to its dark value. */
export const DARK_CLASS: string = 'dark';

export const DARK_QUERY: string = '(prefers-color-scheme: dark)';

/** True when `value` is one of the three theme preferences. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** The theme to paint for a preference, given whether the operating system prefers dark. */
export function resolveTheme(preference: ThemePreference, isSystemDark: boolean): ResolvedTheme {
  if (preference === 'system') {
    return isSystemDark ? 'dark' : 'light';
  }
  return preference;
}

/** Paints `theme` by toggling the dark class on `root`. */
export function applyTheme(root: HTMLElement, theme: ResolvedTheme): void {
  root.classList.toggle(DARK_CLASS, theme === 'dark');
}
