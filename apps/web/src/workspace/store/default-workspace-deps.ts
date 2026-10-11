import { openNautinkDb } from '@nautink/storage/db';
import { toast } from 'sonner';

import type { ActiveIdStorage, DownloadFile, Notifier, WorkspaceDeps } from './workspace-deps.ts';

/** The `localStorage` key that remembers the open diagram. */
export const ACTIVE_ID_KEY: string = 'nautink.activeDiagram';

/** PRD §3.5: changes are written about 400 ms after the last one. */
export const SAVE_DELAY_MS: number = 400;

const ERROR_TOAST_MS: number = 6000;

const toastNotifier: Notifier = {
  info: (message, action): void => {
    toast(
      message,
      action === undefined ? {} : { action: { label: action.label, onClick: action.run } },
    );
  },
  error: (message): void => {
    toast.error(message, { duration: ERROR_TOAST_MS });
  },
};

// Losing the remembered id only means the most recent diagram opens instead, so blocked or full
// storage is tolerated rather than stopping the app.
const localActiveId: ActiveIdStorage = {
  read: (): string | null => {
    try {
      return window.localStorage.getItem(ACTIVE_ID_KEY);
    } catch {
      return null;
    }
  },
  write: (id: string): void => {
    try {
      window.localStorage.setItem(ACTIVE_ID_KEY, id);
    } catch {
      // See above: the next load opens the most recent diagram.
    }
  },
};

/** Saves `file` through a temporary link, the way browsers download generated files. */
export function downloadTextFile(file: DownloadFile): void {
  const url: string = URL.createObjectURL(new Blob([file.text], { type: 'text/plain' }));
  const link: HTMLAnchorElement = document.createElement('a');
  link.href = url;
  link.download = file.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** The real browser: IndexedDB, sonner toasts, `localStorage` and file downloads. */
export function createDefaultWorkspaceDeps(): WorkspaceDeps {
  return {
    openDb: async () => openNautinkDb(),
    notify: toastNotifier,
    download: downloadTextFile,
    activeIdStorage: localActiveId,
    saveDelayMs: SAVE_DELAY_MS,
    now: () => Date.now(),
  };
}
