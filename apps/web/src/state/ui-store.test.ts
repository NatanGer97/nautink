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
      JSON.stringify({ state: { ...DEFAULT_UI_PREFS, themePreference: 'dark' }, version: 1 }),
    );
    await useUiStore.persist.rehydrate();
    expect(useUiStore.getState().themePreference).toBe('dark');
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ state: { activePanel: 'zoom' } }));
    await useUiStore.persist.rehydrate();
    expect(useUiStore.getState().themePreference).toBe('system');
  });

  it('remembers whether the library is open, and keeps older saves that lack it', async () => {
    useUiStore.getState().setLibraryOpen(true);
    const saved = JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}') as {
      state: Record<string, unknown>;
    };
    expect(saved.state.isLibraryOpen).toBe(true);
    const older: Record<string, unknown> = { ...DEFAULT_UI_PREFS, themePreference: 'dark' };
    delete older.isLibraryOpen;
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ state: older, version: 1 }));
    await useUiStore.persist.rehydrate();
    expect(useUiStore.getState()).toMatchObject({ isLibraryOpen: false, themePreference: 'dark' });
  });

  it('remembers change review, and turns it on for older saves that lack it', async () => {
    useUiStore.getState().setReviewChanges(false);
    const saved = JSON.parse(window.localStorage.getItem(UI_STORAGE_KEY) ?? '{}') as {
      state: Record<string, unknown>;
    };
    expect(saved.state.shouldReviewChanges).toBe(false);
    const older: Record<string, unknown> = { ...DEFAULT_UI_PREFS, shouldReviewChanges: undefined };
    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ state: older, version: 1 }));
    await useUiStore.persist.rehydrate();
    expect(useUiStore.getState().shouldReviewChanges).toBe(true);
  });

  it('ignores the canvas mode an earlier build saved: the view is per diagram now', async () => {
    window.localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({ state: { ...DEFAULT_UI_PREFS, canvasMode: 'split' }, version: 1 }),
    );
    await useUiStore.persist.rehydrate();
    expect(useUiStore.getState()).not.toHaveProperty('canvasMode');
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
