import { describe, expect, it } from 'vitest';

import {
  formatShortcut,
  isMacPlatform,
  matchesShortcut,
  SHORTCUTS,
  shortcutLabel,
} from './shortcuts.ts';

import type { KeyEventLike } from './shortcuts.ts';

const key = (overrides: Partial<KeyEventLike>): KeyEventLike => ({
  key: 'k',
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  ...overrides,
});

describe('matchesShortcut', () => {
  it('accepts either ⌘ or Ctrl as the modifier', () => {
    expect(matchesShortcut(key({ metaKey: true }), SHORTCUTS.palette)).toBe(true);
    expect(matchesShortcut(key({ ctrlKey: true, key: 'K' }), SHORTCUTS.palette)).toBe(true);
  });

  it('rejects a missing modifier, a different key, or an extra Shift', () => {
    expect(matchesShortcut(key({}), SHORTCUTS.palette)).toBe(false);
    expect(matchesShortcut(key({ metaKey: true, key: 'j' }), SHORTCUTS.palette)).toBe(false);
    expect(matchesShortcut(key({ metaKey: true, shiftKey: true }), SHORTCUTS.palette)).toBe(false);
  });

  it('tells undo from redo by Shift', () => {
    const redo = key({ key: 'z', metaKey: true, shiftKey: true });
    expect(matchesShortcut(redo, SHORTCUTS.redo)).toBe(true);
    expect(matchesShortcut(redo, SHORTCUTS.undo)).toBe(false);
  });
});

describe('formatShortcut', () => {
  it('uses symbols on macOS', () => {
    expect(formatShortcut(SHORTCUTS.palette, true)).toBe('⌘K');
    expect(formatShortcut(SHORTCUTS.redo, true)).toBe('⇧⌘Z');
    expect(formatShortcut(SHORTCUTS.send, true)).toBe('⌘↵');
  });

  it('spells the modifiers out elsewhere', () => {
    expect(formatShortcut(SHORTCUTS.palette, false)).toBe('Ctrl+K');
    expect(formatShortcut(SHORTCUTS.redo, false)).toBe('Ctrl+Shift+Z');
    expect(formatShortcut({ key: 'Escape', isMod: false }, false)).toBe('Esc');
  });
});

describe('platform', () => {
  it('detects macOS and iOS user agents', () => {
    expect(isMacPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(true);
    expect(isMacPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
  });

  it('formats for the current page', () => {
    expect(shortcutLabel(SHORTCUTS.palette)).toMatch(/K$/);
  });
});
