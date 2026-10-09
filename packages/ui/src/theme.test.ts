import { describe, expect, it } from 'vitest';

import { applyTheme, isThemePreference, resolveTheme, THEME_PREFERENCES } from './theme.ts';

describe('resolveTheme', () => {
  it('follows the system when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('ignores the system when the preference is explicit', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('isThemePreference', () => {
  it('accepts the three preferences only', () => {
    for (const preference of THEME_PREFERENCES) {
      expect(isThemePreference(preference)).toBe(true);
    }
    expect(isThemePreference('sepia')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});

describe('applyTheme', () => {
  it('toggles the dark class on the root', () => {
    const root = document.createElement('html');
    applyTheme(root, 'dark');
    expect(root.classList.contains('dark')).toBe(true);
    applyTheme(root, 'light');
    expect(root.classList.contains('dark')).toBe(false);
  });
});
