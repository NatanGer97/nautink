import type { SaveState } from '../store/autosave.ts';

/** The words for each save state, as v1's status bar shows them. */
export const SAVE_STATE_LABELS: Readonly<Record<SaveState, string>> = {
  saved: 'Saved',
  saving: 'Saving…',
  error: 'Not saved',
};
