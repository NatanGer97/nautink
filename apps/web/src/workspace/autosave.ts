import { updateDiagram } from '@nautink/storage/diagrams';
import { RecordNotFoundError } from '@nautink/storage/errors';

import type { NautinkDb } from '@nautink/storage/db';
import type { DiagramPatch } from '@nautink/storage/diagrams';

/** What the top bar and the status bar say about saving. */
export type SaveState = 'saved' | 'saving' | 'error';

export interface AutosaverOptions {
  getDb: () => NautinkDb;
  delayMs: number;
  onStateChange: (state: SaveState) => void;
  onError: (err: unknown) => void;
}

/**
 * Debounced writes of diagram changes. Patches for the same diagram merge until the delay passes
 * or `flush` runs; writes run one batch at a time, in order. A failed write is kept and retried
 * with the next flush, unless the diagram no longer exists.
 */
export class Autosaver {
  private readonly options: AutosaverOptions;
  private readonly pending: Map<string, DiagramPatch> = new Map<string, DiagramPatch>();
  private timer: ReturnType<typeof setTimeout> | undefined = undefined;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: AutosaverOptions) {
    this.options = options;
  }

  /** True while a change waits to be written. */
  get hasPending(): boolean {
    return this.pending.size > 0;
  }

  /** Queues `patch` for diagram `id` and restarts the delay. */
  schedule(id: string, patch: DiagramPatch): void {
    this.pending.set(id, { ...this.pending.get(id), ...patch });
    this.options.onStateChange('saving');
    this.clearTimer();
    this.timer = setTimeout(() => {
      void this.flush();
    }, this.options.delayMs);
  }

  /** Writes everything queued now, after any write already running. */
  async flush(): Promise<void> {
    this.clearTimer();
    const run: Promise<void> = this.writeAfter(this.queue);
    this.queue = run;
    await run;
  }

  /** Forgets the queued change of a diagram that is being deleted. */
  drop(id: string): void {
    this.pending.delete(id);
  }

  /** Stops the timer and forgets every queued change. */
  dispose(): void {
    this.clearTimer();
    this.pending.clear();
  }

  private clearTimer(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private async writeAfter(previous: Promise<void>): Promise<void> {
    await previous;
    const batch: [string, DiagramPatch][] = [...this.pending];
    this.pending.clear();
    if (batch.length === 0) {
      return;
    }
    const results: boolean[] = await Promise.all(batch.map(async (item) => this.write(item)));
    const didFail: boolean = results.includes(false);
    if (didFail || !this.hasPending) {
      this.options.onStateChange(didFail ? 'error' : 'saved');
    }
  }

  /** True when the write succeeded. */
  private async write([id, patch]: [string, DiagramPatch]): Promise<boolean> {
    try {
      await updateDiagram(this.options.getDb(), id, patch);
      return true;
    } catch (err) {
      if (!(err instanceof RecordNotFoundError)) {
        this.pending.set(id, { ...patch, ...this.pending.get(id) });
      }
      this.options.onError(err);
      return false;
    }
  }
}
