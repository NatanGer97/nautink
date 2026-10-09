import type {
  DiagramLoader,
  EditorModule,
  ParseFailure,
  ParseResult,
} from '@nautink/visual-core/editor-contract';

/** What the canvas shows: the model, and why the latest code did not parse (null when it did). */
export interface SyncSnapshot<Model> {
  model: Model | null;
  failure: ParseFailure | null;
}

/** Writes code as one labelled history step. */
export type CodeWriter = (code: string, label: string) => void;

export interface DiagramSyncOptions<Model> {
  module: Pick<EditorModule<Model>, 'parse' | 'serialize'>;
  load: DiagramLoader;
  /**
   * Called when the code changed from outside the editor (typing, undo/redo, Claude, a restore),
   * with the new model, right before it replaces `previous`. Place new items here.
   */
  onExternal?: (model: Model, previous: Model | null) => void;
}

/** v1's debounce: a pause in typing, shorter while Claude streams so the canvas keeps up. */
export const PARSE_DELAY_MS: number = 300;
export const BUSY_PARSE_DELAY_MS: number = 120;

const EMPTY: SyncSnapshot<never> = { model: null, failure: null };

/**
 * Two-way sync between Mermaid code and an editor model (v1's `useDiagramSync`, outside React).
 * `receive` parses code that came from outside; `commit` serializes an edit and writes it through
 * the history. Code the editor wrote itself is never parsed back, so an edit does not re-place items.
 */
export class DiagramSync<Model> {
  readonly #options: DiagramSyncOptions<Model>;
  readonly #listeners: Set<() => void> = new Set<() => void>();
  #snapshot: SyncSnapshot<Model> = EMPTY;
  #lastCode: string | null = null;
  #write: CodeWriter = (): void => undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #generation: number = 0;
  #hasReceived: boolean = false;

  constructor(options: DiagramSyncOptions<Model>) {
    this.#options = options;
  }

  getSnapshot = (): SyncSnapshot<Model> => this.#snapshot;

  getModel = (): Model | null => this.#snapshot.model;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** Where `commit` writes. The host passes `applyEdit` with source `visual`. */
  setWriter(write: CodeWriter): void {
    this.#write = write;
  }

  /** New code from the store. Parses after a pause (at once the first time) unless the editor wrote it. */
  receive(code: string, isBusy: boolean): void {
    this.#cancel();
    if (code === this.#lastCode) {
      return;
    }
    const generation: number = this.#generation;
    const delay: number = this.#delay(isBusy);
    this.#timer = setTimeout(() => {
      void this.#parse(code, generation);
    }, delay);
  }

  /** Writes `next` as code, as one undo step called `label`, and shows it at once. */
  commit = (next: Model, label: string): void => {
    const code: string = this.#options.module.serialize(next);
    this.#cancel();
    this.#lastCode = code;
    this.#publish({ model: next, failure: null });
    this.#write(code, label);
  };

  /** Shows `next` without writing code: for changes only the canvas has (an auto layout). */
  setModel = (next: Model): void => {
    this.#publish({ ...this.#snapshot, model: next });
  };

  /** Drops a pending parse and any parse still running. */
  dispose(): void {
    this.#cancel();
  }

  #delay(isBusy: boolean): number {
    if (!this.#hasReceived) {
      this.#hasReceived = true;
      return 0;
    }
    return isBusy ? BUSY_PARSE_DELAY_MS : PARSE_DELAY_MS;
  }

  #cancel(): void {
    clearTimeout(this.#timer);
    this.#generation += 1;
  }

  async #parse(code: string, generation: number): Promise<void> {
    const result: ParseResult<Model> = await this.#options.module.parse(code, this.#options.load);
    if (generation === this.#generation) {
      this.#apply(code, result);
    }
  }

  /** An error keeps the last model (read-only); another diagram type drops it. */
  #apply(code: string, result: ParseResult<Model>): void {
    if (result.kind !== 'ok') {
      const model: Model | null = result.kind === 'error' ? this.#snapshot.model : null;
      this.#publish({ model, failure: result });
      return;
    }
    this.#lastCode = code;
    this.#options.onExternal?.(result.model, this.#snapshot.model);
    this.#publish({ model: result.model, failure: null });
  }

  #publish(snapshot: SyncSnapshot<Model>): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
