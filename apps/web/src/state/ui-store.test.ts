import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_UI_PREFS, parseSavedUiPrefs } from './ui-prefs.ts';
import { UI_STORAGE_KEY, useUiStore } from './ui-store.ts';
import { safeLocalStorage } from '../lib/safe-storage.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useUiStore', () => {
  it('opens one panel at a time and toggles the open one closed', () => {
    const { togglePanel } = useUiStore.getState();
    togglePanel('history');
    expect(useUiStore.getState().activePanel).toBe('history');
    togglePanel('diagrams');
    expect(useUiStore.getState().activePanel).toBe('diagrams');
    togglePanel('diagrams');
    expect(useUiStore.getState().activePanel).toBeNull();
  });

  it('opens the chat panel and asks for composer focus', () => {
    useUiStore.getState().setActivePanel(null);
    useUiStore.getState().setPaletteOpen(true);
    useUiStore.getState().focusComposer();
    const state = useUiStore.getState();
    expect(state.activePanel).toBe('chat');
    expect(state.isPaletteOpen).toBe(false);
    expect(state.composerFocusRequest).toBe(1);
  });

  it('persists preferences only, never overlays', () => {
    useUiStore.getState().setThemePreference('dark');
    useUiStore.getState().setSettingsOpen(true);
    const saved = JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}') as {
      state: Record<string, unknown>;
    };
    expect(saved.state.themePreference).toBe('dark');
    expect(saved.state).not.toHaveProperty('isSettingsOpen');
  });

  it('restores saved preferences and ignores a corrupt save', async () => {
    window.localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({ state: { ...DEFAULT_UI_PREFS, canvasMode: 'split' }, version: 1 }),
    );
    await useUiStore.persist.rehydrate();
    expect(useUiStore.getState().canvasMode).toBe('split');
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ state: { canvasMode: 'zoom' } }));
    await useUiStore.persist.rehydrate();
    expect(useUiStore.getState().canvasMode).toBe('preview');
  });
});

describe('parseSavedUiPrefs', () => {
  it('returns the defaults for anything that does not parse', () => {
    expect(parseSavedUiPrefs(undefined)).toEqual(DEFAULT_UI_PREFS);
    expect(parseSavedUiPrefs({ ...DEFAULT_UI_PREFS, defaultModel: 'gpt' })).toEqual(
      DEFAULT_UI_PREFS,
    );
  });
});

describe('safeLocalStorage', () => {
  it('survives storage that throws', () => {
    const error = new Error('blocked');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw error;
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw error;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw error;
    });
    expect(safeLocalStorage.getItem('x')).toBeNull();
    expect(() => safeLocalStorage.setItem('x', '1')).not.toThrow();
    expect(() => safeLocalStorage.removeItem('x')).not.toThrow();
  });

  it('reads and removes what it wrote', () => {
    safeLocalStorage.setItem('x', '1');
    expect(safeLocalStorage.getItem('x')).toBe('1');
    safeLocalStorage.removeItem('x');
    expect(safeLocalStorage.getItem('x')).toBeNull();
  });
});
