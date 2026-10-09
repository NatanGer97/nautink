import { Autosaver } from './autosave.ts';

import type { AutosaverOptions } from './autosave.ts';
import type { NautinkDb } from '@nautink/storage/db';

/** The parts of the workspace that are not React state: the database and the autosaver. */
export class WorkspaceRuntime {
  readonly autosaver: Autosaver;
  private database: NautinkDb | null = null;
  private loads: number = 0;

  constructor(options: Omit<AutosaverOptions, 'getDb'>) {
    this.autosaver = new Autosaver({ ...options, getDb: (): NautinkDb => this.requireDb() });
  }

  /** Bumped by `disconnect`, so a load that finishes afterwards can tell it is stale. */
  get generation(): number {
    return this.loads;
  }

  /** The open database. Throws before `load` has finished. */
  requireDb(): NautinkDb {
    if (this.database === null) {
      throw new Error('The workspace is not loaded yet.');
    }
    return this.database;
  }

  connect(db: NautinkDb): void {
    this.database = db;
  }

  /** Forgets queued saves and closes the database. */
  disconnect(): void {
    this.loads += 1;
    this.autosaver.dispose();
    this.database?.close();
    this.database = null;
  }
}
