import type { NautinkDb } from '@nautink/storage/db';

/** A button on a notice, such as "Undo" after a delete. */
export interface NoticeAction {
  label: string;
  run: () => void;
}

/** How the workspace tells the user what happened. The app shows these as toasts (sonner). */
export interface Notifier {
  info: (message: string, action?: NoticeAction) => void;
  error: (message: string) => void;
}

/** Where the open diagram's id is remembered across reloads. */
export interface ActiveIdStorage {
  read: () => string | null;
  write: (id: string) => void;
}

/** A text file handed to the browser to save. */
export interface DownloadFile {
  fileName: string;
  text: string;
}

/** Everything the workspace store reaches outside itself for, so tests can swap each part. */
export interface WorkspaceDeps {
  openDb: () => Promise<NautinkDb>;
  notify: Notifier;
  download: (file: DownloadFile) => void;
  activeIdStorage: ActiveIdStorage;
  /** How long autosave waits after the last change before writing. */
  saveDelayMs: number;
  now: () => number;
}
