/** A keyboard shortcut. `isMod` is ⌘ on macOS and Ctrl elsewhere. */
export interface Shortcut {
  key: string;
  isMod: boolean;
  isShift?: boolean;
}

export type KeyEventLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey'>;

export type ShortcutName =
  'palette' | 'focusComposer' | 'undo' | 'redo' | 'redoAlt' | 'send' | 'saveVersion';

/** The app's global shortcuts. Features add theirs here so the palette and tooltips agree. */
export const SHORTCUTS: Readonly<Record<ShortcutName, Shortcut>> = {
  palette: { key: 'k', isMod: true },
  focusComposer: { key: '/', isMod: true },
  undo: { key: 'z', isMod: true },
  redo: { key: 'z', isMod: true, isShift: true },
  redoAlt: { key: 'y', isMod: true },
  send: { key: 'Enter', isMod: true },
  saveVersion: { key: 's', isMod: true },
};

/** True when the user agent is macOS or iOS, where the modifier is ⌘. */
export function isMacPlatform(userAgent: string): boolean {
  return /mac|iphone|ipad/i.test(userAgent);
}

/** True when the event is exactly `shortcut` (either ⌘ or Ctrl counts as the modifier). */
export function matchesShortcut(event: KeyEventLike, shortcut: Shortcut): boolean {
  const isModDown: boolean = event.metaKey || event.ctrlKey;
  const isShiftWanted: boolean = shortcut.isShift ?? false;
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    isModDown === shortcut.isMod &&
    event.shiftKey === isShiftWanted
  );
}

const KEY_LABELS: Readonly<Record<string, string>> = { Enter: '↵', Escape: 'Esc' };

/** The shortcut as people read it: `⌘K` and `⇧⌘Z` on macOS, `Ctrl+K` and `Ctrl+Shift+Z` elsewhere. */
export function formatShortcut(shortcut: Shortcut, isMac: boolean): string {
  const key: string = KEY_LABELS[shortcut.key] ?? shortcut.key.toUpperCase();
  const isShift: boolean = shortcut.isShift ?? false;
  if (isMac) {
    return `${isShift ? '⇧' : ''}${shortcut.isMod ? '⌘' : ''}${key}`;
  }
  const parts: string[] = [shortcut.isMod ? 'Ctrl' : '', isShift ? 'Shift' : '', key];
  return parts.filter((part) => part !== '').join('+');
}

/** `formatShortcut` for the platform this page runs on. */
export function shortcutLabel(shortcut: Shortcut): string {
  return formatShortcut(shortcut, isMacPlatform(navigator.userAgent));
}
