import type { StateStorage } from 'zustand/middleware';

/**
 * `localStorage` that tolerates being unavailable (private windows, blocked site data, a full
 * quota). Only UI preferences live here, so losing a write costs the user a remembered layout,
 * never data; failing the whole app over it would be worse.
 */
export const safeLocalStorage: StateStorage = {
  getItem(name: string): string | null {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name: string, value: string): void {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // See the note above: a preference that cannot be saved is simply not remembered.
    }
  },
  removeItem(name: string): void {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Same as setItem.
    }
  },
};
