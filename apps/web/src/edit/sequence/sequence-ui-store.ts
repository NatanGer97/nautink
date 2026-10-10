import { NO_SELECTION } from './sequence-types.ts';

import type { EditTarget, SequenceSelection } from './sequence-types.ts';

/** What the canvas shows besides the model: the selection and the text open for editing. */
export interface SequenceUi {
  selection: SequenceSelection;
  editing: EditTarget | null;
}

/**
 * The editor's selection and inline edit, outside React, so actions and pointer handlers always
 * read the newest values (the canvas reads them through `useSyncExternalStore`).
 */
export class SequenceUiStore {
  #state: SequenceUi = { selection: NO_SELECTION, editing: null };
  readonly #listeners: Set<() => void> = new Set<() => void>();

  getSnapshot = (): SequenceUi => this.#state;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  select = (selection: SequenceSelection): void => {
    this.#publish({ ...this.#state, selection });
  };

  edit = (editing: EditTarget | null): void => {
    this.#publish({ ...this.#state, editing });
  };

  #publish(state: SequenceUi): void {
    this.#state = state;
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
