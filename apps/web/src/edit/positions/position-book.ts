import type { EditorPositionStore } from './app-position-store.ts';
import type { Point } from '@nautink/visual-core/geometry';
import type { Position, PositionKey, PositionMap } from '@nautink/visual-core/positions';

/** What the canvas reads: the positions, and whether the saved ones have loaded yet. */
export interface PositionSnapshot {
  positions: PositionMap;
  isLoaded: boolean;
}

export interface PositionBookOptions {
  store: EditorPositionStore;
  key: PositionKey;
  /** False while an older version is on view: placing its items must not overwrite the saved spots. */
  canSave: boolean;
  onError: (message: string) => void;
  saveDelayMs?: number;
}

/** Dragging writes many times a second; the database gets the spot once the hand rests. */
export const POSITION_SAVE_DELAY_MS: number = 400;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * One editor's canvas positions for one diagram (v1's `posRef` + `savePositions`). Mermaid lays
 * diagrams out itself, so these exist only here and in IndexedDB. Every change is published at
 * once and saved after a pause.
 */
export class PositionBook {
  readonly #options: PositionBookOptions;
  readonly #listeners: Set<() => void> = new Set<() => void>();
  #snapshot: PositionSnapshot = { positions: {}, isLoaded: false };
  #timer: ReturnType<typeof setTimeout> | undefined;
  #canSave: boolean;

  constructor(options: PositionBookOptions) {
    this.#options = options;
    this.#canSave = options.canSave;
  }

  getSnapshot = (): PositionSnapshot => this.#snapshot;

  /** The newest positions, for event handlers. */
  get = (): PositionMap => this.#snapshot.positions;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** Reads the saved positions once. A failure is reported and the canvas lays itself out. */
  async load(): Promise<void> {
    try {
      const saved: PositionMap = await this.#options.store.load(this.#options.key);
      this.#publish({ positions: { ...saved, ...this.#snapshot.positions }, isLoaded: true });
    } catch (err) {
      this.#options.onError(`Could not load the canvas layout: ${errorText(err)}`);
      this.#publish({ ...this.#snapshot, isLoaded: true });
    }
  }

  /** Puts one item at `point`, keeping what else its entry holds (the label tag). */
  set = (id: string, point: Point): void => {
    const current: Position | undefined = Object.hasOwn(this.get(), id)
      ? this.get()[id]
      : undefined;
    this.replace({ ...this.get(), [id]: { ...current, x: point.x, y: point.y } });
  };

  /** Moves items by (dx, dy): keyboard nudges. */
  move = (ids: readonly string[], delta: Point): void => {
    const next: PositionMap = { ...this.get() };
    for (const id of ids.filter((item: string) => Object.hasOwn(next, item))) {
      const position: Position | undefined = next[id];
      if (position !== undefined) {
        next[id] = { ...position, x: position.x + delta.x, y: position.y + delta.y };
      }
    }
    this.replace(next);
  };

  /** Swaps in a whole new set of positions (a layout, placed items, label tags). */
  replace = (positions: PositionMap): void => {
    this.#publish({ ...this.#snapshot, positions });
    this.#scheduleSave();
  };

  setCanSave(canSave: boolean): void {
    this.#canSave = canSave;
  }

  /** Writes a pending save now (the editor is closing). */
  async flush(): Promise<void> {
    if (this.#timer === undefined) {
      return;
    }
    clearTimeout(this.#timer);
    this.#timer = undefined;
    await this.#save();
  }

  #scheduleSave(): void {
    if (!this.#canSave) {
      return;
    }
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      void this.#save();
    }, this.#options.saveDelayMs ?? POSITION_SAVE_DELAY_MS);
  }

  async #save(): Promise<void> {
    try {
      await this.#options.store.save(this.#options.key, this.get());
    } catch (err) {
      this.#options.onError(`Could not save the canvas layout: ${errorText(err)}`);
    }
  }

  #publish(snapshot: PositionSnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
